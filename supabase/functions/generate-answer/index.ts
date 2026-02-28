// import { createClient } from "jsr:@supabase/supabase-js@2";

// const ALLOWED_ORIGINS = [
//     "https://merica-rowley.github.io",
//     "http://localhost:3000",
//     "http://127.0.0.1:3000",
//     "http://localhost:5500",
//     "http://127.0.0.1:5500",
// ];

// function corsHeaders(origin: string | null) {
//     const allowed =
//         origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
//     return {
//         "Access-Control-Allow-Origin": allowed,
//         "Access-Control-Allow-Headers":
//             "authorization, x-client-info, apikey, content-type",
//         "Access-Control-Allow-Methods": "POST, OPTIONS",
//     };
// }

// Deno.serve(async (req) => {
//     const origin = req.headers.get("origin");

//     if (req.method === "OPTIONS") {
//         return new Response(null, { status: 204, headers: corsHeaders(origin) });
//     }

//     if (req.method !== "POST") {
//         return new Response(JSON.stringify({ error: "Method not allowed" }), {
//             status: 405,
//             headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
//         });
//     }

//     const authHeader = req.headers.get("Authorization");
//     if (!authHeader) {
//         return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
//             status: 401,
//             headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
//         });
//     }

//     const supabase = createClient(
//         Deno.env.get("SUPABASE_URL")!,
//         Deno.env.get("SUPABASE_ANON_KEY")!,
//         { global: { headers: { Authorization: authHeader } } }
//     );

//     const { data: { user }, error: authError } = await supabase.auth.getUser();
//     if (authError || !user) {
//         return new Response(JSON.stringify({ error: "Unauthorized" }), {
//             status: 401,
//             headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
//         });
//     }

//     let question: string;
//     let context_talks: unknown[];
//     try {
//         const body = await req.json();
//         question = body?.question;
//         context_talks = body?.context_talks;
//         if (!question || typeof question !== "string" || question.trim() === "") {
//             throw new Error("missing question");
//         }
//         if (!Array.isArray(context_talks) || context_talks.length === 0) {
//             throw new Error("missing context_talks");
//         }
//     } catch {
//         return new Response(
//             JSON.stringify({ error: 'Request body must include "question" and "context_talks".' }),
//             {
//                 status: 400,
//                 headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
//             }
//         );
//     }

//     const openaiKey = Deno.env.get("OPENAI_API_KEY");
//     if (!openaiKey) {
//         return new Response(JSON.stringify({ error: "OpenAI API key not configured" }), {
//             status: 500,
//             headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
//         });
//     }

//     // Build context string from talks
//     const context = (context_talks as Array<{ title?: string; speaker?: string; text?: string }>)
//         .map((t) => `Talk: "${t.title}" by ${t.speaker}\n${t.text}`)
//         .join("\n\n");

//     const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
//         method: "POST",
//         headers: {
//             Authorization: `Bearer ${openaiKey}`,
//             "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//             model: "gpt-4o-mini",
//             messages: [
//                 {
//                     role: "system",
//                     content:
//                         "You are a helpful assistant that answers questions based on conference talks. " +
//                         "Use only the provided context to answer. If the answer isn't in the context, say so.",
//                 },
//                 {
//                     role: "user",
//                     content: `Context:\n${context}\n\nQuestion: ${question.trim()}`,
//                 },
//             ],
//             max_tokens: 500,
//             temperature: 0.3,
//         }),
//     });

//     if (!openaiRes.ok) {
//         const errText = await openaiRes.text();
//         console.error("OpenAI error:", errText);
//         return new Response(JSON.stringify({ error: "Failed to generate answer" }), {
//             status: 502,
//             headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
//         });
//     }

//     const openaiData = await openaiRes.json();
//     const answer = openaiData.choices[0].message.content;

//     return new Response(JSON.stringify({ answer }), {
//         status: 200,
//         headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
//     });
// });

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    // Verify authenticated user
    const authResult = await requireAuth(req);
    if ("error" in authResult) return authResult.error;

    try {
        const { question, context_talks } = await req.json();

        if (!question || typeof question !== "string") {
            return new Response(
                JSON.stringify({ error: "Missing or invalid 'question' field" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!context_talks || !Array.isArray(context_talks)) {
            return new Response(
                JSON.stringify({ error: "Missing or invalid 'context_talks' field" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const openaiKey = Deno.env.get("OPENAI_API_KEY");
        if (!openaiKey) {
            return new Response(
                JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Build context from the talk data
        const contextText = context_talks
            .map(
                (talk: { title: string; speaker: string; text: string }) =>
                    `"${talk.title}" by ${talk.speaker}:\n${talk.text}`
            )
            .join("\n\n---\n\n");

        const systemPrompt = `You are a helpful assistant that answers questions about General Conference talks from The Church of Jesus Christ of Latter-day Saints. Use ONLY the provided talk excerpts to answer. If the answer isn't found in the excerpts, say so. Cite which talk(s) you're drawing from.`;

        const userPrompt = `Here are relevant talk excerpts:\n\n${contextText}\n\n---\n\nQuestion: ${question}`;

        // Call OpenAI Chat Completions API
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openaiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                temperature: 0.3,
                max_tokens: 1024,
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            return new Response(
                JSON.stringify({ error: err.error?.message || "OpenAI API error" }),
                { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const data = await response.json();
        const answer = data.choices[0].message.content;

        return new Response(
            JSON.stringify({ answer }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});