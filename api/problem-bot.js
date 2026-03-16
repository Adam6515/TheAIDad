// AI Dad — "Tell Me Your Problem" Bot
// Receives Tally webhook → Claude Sonnet 4.6 analyses → emails solution to submitter + notifies Adam

import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "hello@theaidadbuilds.com";
const NOTIFY_EMAIL = "adamtimothy.cubitt@gmail.com";

// Extract fields from Tally webhook payload
function extractFields(body) {
  const fields = body?.data?.fields || [];
  const get = (label) => {
    const field = fields.find(
      (f) => f.label?.toLowerCase().includes(label.toLowerCase())
    );
    return field?.value || "";
  };

  return {
    name: get("name") || get("your name") || "Friend",
    email: get("email") || get("your email") || "",
    problem: get("problem") || get("business") || get("tell") || fields[fields.length - 1]?.value || "",
  };
}

// Build the Claude prompt
function buildPrompt(name, problem) {
  return `You are the AI Dad bot — a friendly, practical AI assistant helping small business owners and everyday people solve real problems with AI.

Someone has just submitted the following business problem:

Name: ${name}
Problem: ${problem}

Your job is to write a warm, practical response that:
1. Acknowledges their specific problem in a relatable way
2. Suggests 2-3 concrete ways AI could help solve it (be specific, not vague)
3. Mentions any free or low-cost tools that could help
4. Ends with an encouraging note that makes them feel this is achievable

Keep the tone: friendly, practical, dad-energy. Not corporate. Not guru. Like a knowledgeable mate who happens to know a lot about AI.

Format the response clearly with short paragraphs. No bullet walls. Max 300 words.`;
}

export default async function handler(req, res) {
  // Only accept POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { name, email, problem } = extractFields(req.body);

    // Validate we have the minimum needed
    if (!problem) {
      return res.status(400).json({ error: "No problem found in submission" });
    }

    // Call Claude Sonnet 4.6
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      messages: [{ role: "user", content: buildPrompt(name, problem) }],
    });

    const aiResponse = message.content[0].text;

    // Send solution email to submitter (if they gave an email)
    if (email) {
      await resend.emails.send({
        from: `AI Dad <${FROM_EMAIL}>`,
        to: email,
        subject: `Here's how AI could help with your problem, ${name} 🤖`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0a0a0f; color: #f1f5f9; border-radius: 12px;">
            <div style="margin-bottom: 24px;">
              <h1 style="color: #f59e0b; font-size: 24px; margin: 0 0 4px;">AI Dad</h1>
              <p style="color: #94a3b8; font-size: 13px; margin: 0;">Learning AI in Public</p>
            </div>

            <p style="color: #94a3b8; margin-bottom: 20px;">Hey ${name}, thanks for sharing your problem. Here's what I think AI could do for you 👇</p>

            <div style="background: #13131a; border: 1px solid #1e1e2e; border-radius: 8px; padding: 20px; margin-bottom: 24px; line-height: 1.7; color: #f1f5f9;">
              ${aiResponse.replace(/\n/g, "<br/>")}
            </div>

            <div style="background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="color: #f59e0b; font-weight: bold; margin: 0 0 8px;">Want me to build a solution for you?</p>
              <p style="color: #94a3b8; font-size: 14px; margin: 0;">I document every build in public. If your problem becomes a build, I'll share it with the whole community — and you'll get the solution free.</p>
            </div>

            <div style="border-top: 1px solid #1e1e2e; padding-top: 16px; font-size: 13px; color: #475569;">
              <p style="margin: 0 0 8px;">Follow the builds:</p>
              <p style="margin: 0;">
                <a href="https://instagram.com/theai.dad" style="color: #f59e0b; margin-right: 12px;">Instagram</a>
                <a href="https://twitter.com/theai_dad" style="color: #f59e0b; margin-right: 12px;">X</a>
                <a href="https://tiktok.com/@theai.dad" style="color: #f59e0b; margin-right: 12px;">TikTok</a>
                <a href="https://youtube.com/@theAI.Dad1" style="color: #f59e0b;">YouTube</a>
              </p>
            </div>
          </div>
        `,
      });
    }

    // Notify Adam of every submission
    await resend.emails.send({
      from: `AI Dad Bot <${FROM_EMAIL}>`,
      to: NOTIFY_EMAIL,
      subject: `New problem submission from ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 24px;">
          <h2 style="color: #f59e0b;">New Problem Submission 🔔</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email || "not provided"}</p>
          <hr style="border-color: #eee; margin: 16px 0;"/>
          <p><strong>Their Problem:</strong></p>
          <p style="background: #f8f9fa; padding: 16px; border-radius: 8px;">${problem}</p>
          <hr style="border-color: #eee; margin: 16px 0;"/>
          <p><strong>AI Response Sent:</strong></p>
          <p style="background: #f8f9fa; padding: 16px; border-radius: 8px;">${aiResponse}</p>
        </div>
      `,
    });

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("Problem bot error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
}
