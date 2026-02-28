// import { createClient } from "jsr:@supabase/supabase-js@2";

// const ALLOWED_ORIGINS = [
//     "https://merica-rowley.github.io",       // GitHub Pages
//     "http://localhost:3000",           // local dev
//     "http://127.0.0.1:3000",
//     "http://localhost:5500",           // Live Server / VS Code
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

//     // Handle CORS pre-flight
//     if (req.method === "OPTIONS") {
//         return new Response(null, { status: 204, headers: corsHeaders(origin) });
//     }

//     if (req.method !== "POST") {
//         return new Response(JSON.stringify({ error: "Method not allowed" }), {
//             status: 405,
//             headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
//         });
//     }

//     // --- Auth verification ---
//     const authHeader = req.headers.get("Authorization");
//     if (!authHeader) {
//         return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
//             status: 401,
//             headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
//         });
//     }

//     // Validate the JWT against your Supabase project
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

//     // --- Parse body ---
//     let question: string;
//     try {
//         const body = await req.json();
//         question = body?.question;
//         if (!question || typeof question !== "string" || question.trim() === "") {
//             throw new Error("missing question");
//         }
//     } catch {
//         return new Response(
//             JSON.stringify({ error: 'Request body must be JSON with a "question" string.' }),
//             {
//                 status: 400,
//                 headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
//             }
//         );
//     }

//     // --- Call OpenAI embeddings ---
//     const openaiKey = Deno.env.get("OPENAI_API_KEY");
//     if (!openaiKey) {
//         return new Response(JSON.stringify({ error: "OpenAI API key not configured" }), {
//             status: 500,
//             headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
//         });
//     }

//     const openaiRes = await fetch("https://api.openai.com/v1/embeddings", {
//         method: "POST",
//         headers: {
//             Authorization: `Bearer ${openaiKey}`,
//             "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//             model: "text-embedding-3-small",
//             input: question.trim(),
//         }),
//     });

//     if (!openaiRes.ok) {
//         const errText = await openaiRes.text();
//         console.error("OpenAI error:", errText);
//         return new Response(JSON.stringify({ error: "Failed to generate embedding" }), {
//             status: 502,
//             headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
//         });
//     }

//     const openaiData = await openaiRes.json();
//     const embedding: number[] = openaiData.data[0].embedding;

//     return new Response(JSON.stringify({ embedding }), {
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
        const { question } = await req.json();

        if (!question || typeof question !== "string") {
            return new Response(
                JSON.stringify({ error: "Missing or invalid 'question' field" }),
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

        // Call OpenAI Embeddings API
        const response = await fetch("https://api.openai.com/v1/embeddings", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openaiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "text-embedding-3-small",
                input: question,
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
        const embedding = data.data[0].embedding;

        return new Response(
            JSON.stringify({ embedding }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});