import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Declare Supabase AI global
declare const Supabase: {
  ai: {
    Session: new (model: string) => {
      run: (input: string, options?: { mean_pool?: boolean; normalize?: boolean }) => Promise<Float32Array>;
    };
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Initialize the embedding model
const embeddingModel = new Supabase.ai.Session('gte-small');

async function getEmbedding(text: string): Promise<string> {
  const embedding = await embeddingModel.run(text.slice(0, 1500), {
    mean_pool: true,
    normalize: true,
  });
  const arr = Array.from(embedding as Float32Array);
  return `[${arr.join(',')}]`;
}

// Demo files to simulate Google Drive content
const DEMO_FILES = [
  {
    fileId: "gdrive_demo_1",
    name: "Q4 2024 Strategy Document",
    mimeType: "application/vnd.google-apps.document",
    webViewLink: "https://docs.google.com/document/d/demo1",
    folderPath: "Business/Strategy",
    content: "Our Q4 2024 strategy focuses on three key areas: expanding market presence in enterprise SaaS, launching the new AI-powered analytics dashboard, and improving customer retention through enhanced support. The enterprise SaaS expansion will target Fortune 500 companies with our new enterprise tier pricing. The AI analytics dashboard will provide real-time insights using machine learning models trained on customer data patterns. Customer retention improvements include 24/7 support coverage and proactive account management."
  },
  {
    fileId: "gdrive_demo_2",
    name: "Product Roadmap 2025",
    mimeType: "application/vnd.google-apps.document",
    webViewLink: "https://docs.google.com/document/d/demo2",
    folderPath: "Product/Planning",
    content: "The 2025 product roadmap includes major initiatives in natural language processing, multi-modal AI capabilities, and platform scalability. Q1 will focus on NLP improvements for document understanding. Q2 brings multi-modal features combining text, image, and audio analysis. Q3 emphasizes horizontal scaling to support 10x user growth. Q4 introduces advanced collaboration features including real-time co-editing and commenting. Each quarter includes security enhancements and performance optimizations."
  },
  {
    fileId: "gdrive_demo_3",
    name: "Engineering Best Practices Guide",
    mimeType: "application/pdf",
    webViewLink: "https://drive.google.com/file/d/demo3",
    folderPath: "Engineering/Documentation",
    content: "This guide covers engineering best practices for our development teams. Code review standards require at least two approvals for production changes. Testing requirements include unit tests with 80% coverage minimum, integration tests for all API endpoints, and end-to-end tests for critical user flows. Deployment processes use blue-green deployment with automatic rollback on failure. Monitoring includes distributed tracing, error tracking, and performance metrics dashboards."
  },
  {
    fileId: "gdrive_demo_4",
    name: "Customer Success Playbook",
    mimeType: "application/vnd.google-apps.document",
    webViewLink: "https://docs.google.com/document/d/demo4",
    folderPath: "Customer Success",
    content: "The customer success playbook defines our approach to ensuring customer satisfaction and retention. Onboarding follows a 30-60-90 day framework with specific milestones. Health scoring combines usage metrics, support ticket sentiment, and renewal likelihood. Expansion opportunities are identified through product usage patterns and expressed needs. Escalation procedures ensure executive involvement for at-risk accounts. Quarterly business reviews present value delivered and future opportunities."
  },
  {
    fileId: "gdrive_demo_5",
    name: "Security Compliance Report",
    mimeType: "application/pdf",
    webViewLink: "https://drive.google.com/file/d/demo5",
    folderPath: "Security/Compliance",
    content: "This security compliance report covers our SOC 2 Type II certification, GDPR compliance status, and HIPAA readiness assessment. SOC 2 audit completed with no findings, covering security, availability, and confidentiality. GDPR compliance includes data processing agreements, privacy impact assessments, and data subject request workflows. HIPAA readiness at 95% with remaining items focused on business associate agreements. Penetration testing conducted quarterly with all critical findings resolved within SLA."
  },
  {
    fileId: "gdrive_demo_6",
    name: "AI Research Notes - LLM Fine-tuning",
    mimeType: "application/vnd.google-apps.document",
    webViewLink: "https://docs.google.com/document/d/demo6",
    folderPath: "Research/AI",
    content: "Research notes on large language model fine-tuning approaches. Parameter-efficient fine-tuning using LoRA reduces training costs by 90% while maintaining model quality. Instruction tuning improves task-specific performance on document classification and entity extraction. Retrieval-augmented generation combines fine-tuned models with vector search for improved accuracy and reduced hallucinations. Evaluation metrics include perplexity, task-specific F1 scores, and human preference ratings. Production deployment uses quantized models for inference efficiency."
  },
  {
    fileId: "gdrive_demo_7",
    name: "Marketing Campaign Analysis",
    mimeType: "application/vnd.google-apps.document",
    webViewLink: "https://docs.google.com/document/d/demo7",
    folderPath: "Marketing/Analytics",
    content: "Q3 marketing campaign analysis shows strong performance across channels. Paid search delivered 45% increase in qualified leads with 20% lower cost per acquisition. Content marketing generated 2.5x organic traffic growth through SEO-optimized blog posts and technical guides. Social media engagement increased 60% with LinkedIn emerging as top B2B channel. Email campaigns achieved 35% open rates and 12% click-through rates, above industry benchmarks. Attribution modeling confirms multi-touch influence on enterprise deals."
  },
  {
    fileId: "gdrive_demo_8",
    name: "Infrastructure Cost Optimization",
    mimeType: "application/pdf",
    webViewLink: "https://drive.google.com/file/d/demo8",
    folderPath: "Engineering/Infrastructure",
    content: "Infrastructure cost optimization report identifies savings opportunities across cloud spending. Reserved instance purchases provide 40% savings on compute. Spot instances for batch processing reduce costs by 70%. Storage tiering moves cold data to glacier storage saving 85% on archive costs. Right-sizing analysis shows 30% of instances are over-provisioned. Recommendations include automated scaling policies, container density optimization, and serverless migration for event-driven workloads."
  }
];

function chunkText(text: string, maxChars: number = 800): string[] {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return [];
  const out: string[] = [];
  for (let i = 0; i < t.length; i += maxChars) {
    out.push(t.slice(i, i + maxChars));
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { connectionId } = await req.json();
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get connection
    const { data: connection, error: connError } = await supabase
      .from("gdrive_connections")
      .select("*")
      .eq("id", connectionId)
      .single();

    if (connError || !connection) {
      throw new Error("Connection not found");
    }

    // Update sync status to indexing
    await supabase
      .from("gdrive_sync_status")
      .update({ status: "indexing", error: null })
      .eq("connection_id", connectionId);

    console.log("Starting Google Drive sync for connection:", connectionId);

    // Clear existing data for this connection
    await supabase
      .from("gdrive_files")
      .delete()
      .eq("connection_id", connectionId);

    let totalFiles = 0;
    let totalChunks = 0;

    // Process demo files (in production, this would fetch from Google Drive API)
    for (const file of DEMO_FILES) {
      console.log(`Processing file: ${file.name}`);

      // Insert file record
      const { data: fileRecord, error: fileError } = await supabase
        .from("gdrive_files")
        .insert({
          connection_id: connectionId,
          file_id: file.fileId,
          name: file.name,
          mime_type: file.mimeType,
          web_view_link: file.webViewLink,
          folder_path: file.folderPath,
          full_text: file.content,
          modified_time: new Date().toISOString(),
          indexed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (fileError) {
        console.error(`Error inserting file ${file.name}:`, fileError);
        continue;
      }

      totalFiles++;

      // Chunk and embed content
      const chunks = chunkText(file.content, 800);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunkId = `${file.fileId}::c${i + 1}`;
        const chunkContent = chunks[i];

        try {
          console.log(`Generating embedding for chunk ${i + 1} of ${file.name}`);
          const embedding = await getEmbedding(`${file.name}\n\n${chunkContent}`);

          const { error: chunkError } = await supabase
            .from("gdrive_chunks")
            .insert({
              file_id: fileRecord.id,
              chunk_id: chunkId,
              chunk_index: i,
              content: chunkContent,
              embedding: embedding,
            });

          if (chunkError) {
            console.error(`Error inserting chunk ${chunkId}:`, chunkError);
          } else {
            totalChunks++;
          }
        } catch (embError) {
          console.error(`Error embedding chunk ${chunkId}:`, embError);
        }
      }
    }

    // Update sync status
    await supabase
      .from("gdrive_sync_status")
      .update({
        files_count: totalFiles,
        chunks_count: totalChunks,
        status: "indexed",
        synced_at: new Date().toISOString(),
        error: null,
      })
      .eq("connection_id", connectionId);

    console.log(`Sync complete: ${totalFiles} files, ${totalChunks} chunks`);

    return new Response(
      JSON.stringify({
        ok: true,
        filesCount: totalFiles,
        chunksCount: totalChunks,
        hasMore: false,
        message: `Indexed ${totalFiles} files with ${totalChunks} chunks`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);

    try {
      const { connectionId } = await req.json();
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await supabase
        .from("gdrive_sync_status")
        .update({ status: "error", error: String(error) })
        .eq("connection_id", connectionId);
    } catch {}

    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
