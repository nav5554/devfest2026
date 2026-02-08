import { runTask } from "@/lib/browser-use";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

export const maxDuration = 120;

export async function POST(req: Request) {
  const { name, website, address, mode = "quick" } = await req.json();
  console.log(`[enrich] name="${name}" website="${website}" mode=${mode}`);

  if (!name) {
    return new Response(
      JSON.stringify({ error: "name is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        if (mode === "deep" && website) {
          // Deep mode: Use Browser Use Cloud to browse the website
          send({ type: "step", message: `Starting deep research on ${name}...` });

          const { output } = await runTask(
            `Go to ${website}. Your goal is to research this business AND make contact with them.\n\n` +
            `STEP 1 - RESEARCH: Look for About, Contact, and Team pages. ` +
            `Find the owner's name, CEO name, email addresses, and phone numbers. ` +
            `Check the footer and header for contact info.\n\n` +
            `STEP 2 - MAKE CONTACT: Try every available channel:\n` +
            `- If there is a Contact Us form, fill it out with:\n` +
            `  Name: "Alex from LeadFlow"\n` +
            `  Email: "alex@leadflow.ai"\n` +
            `  Phone: "(628) 400-0974"\n` +
            `  Message: "Hi! I came across ${name} and I'm really impressed with what you do. ` +
            `I work with local businesses to help them grow their customer base and online presence. ` +
            `I'd love to chat for a few minutes about some ideas I have specifically for your business. ` +
            `Would you be open to a quick call this week?"\n` +
            `- If there is a chat widget, open it and send a similar friendly message.\n` +
            `- If there is a "Request a Quote" or "Book a Consultation" form, fill it out.\n` +
            `- Note any email addresses you find (mailto links, text on page).\n\n` +
            `STEP 3 - REPORT: List everything you found AND what outreach actions you took ` +
            `(e.g. "Submitted contact form", "Found email: owner@business.com", etc).`,
            (event) => {
              // Forward all events as "step" so the frontend picks up debugUrl
              send({
                type: "step",
                message: event.message,
                debugUrl: event.debugUrl,
              });
            },
            website
          );

          const extracted = await extractWithGemini(name, output);
          send({ type: "result", data: extracted });
        } else {
          // Quick mode: Firecrawl scrape + Gemini extraction
          send({ type: "step", message: `Scraping ${website || name}...` });

          let content = "";
          if (website) {
            const scrapeRes = await fetch(
              "https://api.firecrawl.dev/v1/scrape",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
                },
                body: JSON.stringify({
                  url: website,
                  formats: ["markdown"],
                  onlyMainContent: true,
                }),
              }
            );
            const scrapeJson = await scrapeRes.json();
            if (scrapeJson.success) {
              content = scrapeJson.data?.markdown ?? "";
              console.log(
                `[enrich] scraped ${content.length} chars from ${website}`
              );
              send({
                type: "step",
                message: `Scraped ${content.length} chars, extracting info...`,
              });
            } else {
              console.error(`[enrich] scrape failed:`, scrapeJson.error);
              send({
                type: "step",
                message: `Scrape failed, trying web search...`,
              });
            }
          }

          // If no website or scrape failed, try a web search
          if (!content) {
            send({ type: "step", message: `Searching for ${name}...` });
            const searchRes = await fetch(
              "https://api.firecrawl.dev/v1/search",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
                },
                body: JSON.stringify({
                  query: `${name} ${address || ""} owner contact email`,
                  limit: 3,
                  scrapeOptions: { formats: ["markdown"] },
                }),
              }
            );
            const searchJson = await searchRes.json();
            if (searchJson.success && searchJson.data?.length > 0) {
              content = searchJson.data
                .map(
                  (r: { markdown?: string }) => r.markdown ?? ""
                )
                .join("\n\n---\n\n")
                .slice(0, 10000);
              send({
                type: "step",
                message: `Found ${searchJson.data.length} sources, extracting...`,
              });
            }
          }

          if (!content) {
            send({
              type: "result",
              data: { ownerName: "", email: "", ceoPhone: "" },
            });
          } else {
            const extracted = await extractWithGemini(name, content);
            send({ type: "result", data: extracted });
          }
        }
      } catch (err) {
        console.error(`[enrich] error:`, err);
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Enrichment failed",
        });
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function extractWithGemini(
  businessName: string,
  content: string
): Promise<{ ownerName: string; email: string; ceoPhone: string; about: string }> {
  const truncated = content.slice(0, 8000);

  try {
    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: z.object({
        ownerName: z.string().describe("Owner's, founder's, or CEO's full name. Empty if not found."),
        email: z.string().describe("Contact email address. Empty if not found."),
        ceoPhone: z.string().describe("Owner's or CEO's direct phone number. Empty if not found."),
        about: z.string().describe("1-2 sentence summary of what this business does, their specialties, hours, or notable details. Empty if not found."),
      }),
      prompt:
        `Extract information about the business "${businessName}" from the following content.\n\n` +
        `IMPORTANT: Only include information that is ACTUALLY present in the content. Do NOT fabricate or guess.\n\n` +
        `Content:\n${truncated}`,
    });

    console.log(`[enrich] AI SDK result: owner=${object.ownerName} email=${object.email} about=${object.about.slice(0, 60)}...`);
    return object;
  } catch (err) {
    console.error(`[enrich] AI SDK extraction error:`, err);
    return { ownerName: "", email: "", ceoPhone: "", about: "" };
  }
}
