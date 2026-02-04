import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { getUserIdOptional } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, bundleId, docId } = await req.json();

    const supabase = getServiceClient();
    const userId = await getUserIdOptional(req);

    switch (action) {
      case "create": {
        const newBundleId = `b_${Date.now()}`;
        const { data, error } = await supabase
          .from("bundles")
          .insert({
            bundle_id: newBundleId,
            locked: false,
            user_id: userId,
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ ok: true, bundleId: newBundleId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "add": {
        if (!bundleId || !docId) {
          return new Response(
            JSON.stringify({ ok: false, error: "Missing bundleId or docId" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get bundle (with user filtering)
        let bundleQuery = supabase
          .from("bundles")
          .select("*")
          .eq("bundle_id", bundleId);

        if (userId) {
          bundleQuery = bundleQuery.or(`user_id.eq.${userId},user_id.is.null`);
        }

        const { data: bundle, error: bundleError } = await bundleQuery.maybeSingle();

        if (bundleError || !bundle) {
          return new Response(
            JSON.stringify({ ok: false, error: "Bundle not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (bundle.locked) {
          return new Response(
            JSON.stringify({ ok: false, error: "Bundle is locked" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get document
        const { data: doc } = await supabase
          .from("documents")
          .select("id")
          .eq("doc_id", docId)
          .maybeSingle();

        if (!doc) {
          return new Response(
            JSON.stringify({ ok: false, error: "Document not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Add to bundle
        await supabase
          .from("bundle_documents")
          .upsert(
            { bundle_id: bundle.id, document_id: doc.id },
            { onConflict: "bundle_id,document_id" }
          );

        // Get updated doc list
        const { data: bundleDocs } = await supabase
          .from("bundle_documents")
          .select("document_id, documents(doc_id)")
          .eq("bundle_id", bundle.id);

        const docIds = bundleDocs?.map((bd: any) => bd.documents?.doc_id).filter(Boolean) || [];

        return new Response(
          JSON.stringify({ ok: true, docIds, locked: bundle.locked }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "remove": {
        if (!bundleId || !docId) {
          return new Response(
            JSON.stringify({ ok: false, error: "Missing bundleId or docId" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        let bundleQuery = supabase
          .from("bundles")
          .select("*")
          .eq("bundle_id", bundleId);

        if (userId) {
          bundleQuery = bundleQuery.or(`user_id.eq.${userId},user_id.is.null`);
        }

        const { data: bundle } = await bundleQuery.maybeSingle();

        if (!bundle) {
          return new Response(
            JSON.stringify({ ok: false, error: "Bundle not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (bundle.locked) {
          return new Response(
            JSON.stringify({ ok: false, error: "Bundle is locked" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: doc } = await supabase
          .from("documents")
          .select("id")
          .eq("doc_id", docId)
          .maybeSingle();

        if (doc) {
          await supabase
            .from("bundle_documents")
            .delete()
            .eq("bundle_id", bundle.id)
            .eq("document_id", doc.id);
        }

        const { data: bundleDocs } = await supabase
          .from("bundle_documents")
          .select("document_id, documents(doc_id)")
          .eq("bundle_id", bundle.id);

        const docIds = bundleDocs?.map((bd: any) => bd.documents?.doc_id).filter(Boolean) || [];

        return new Response(
          JSON.stringify({ ok: true, docIds, locked: bundle.locked }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "lock": {
        if (!bundleId) {
          return new Response(
            JSON.stringify({ ok: false, error: "Missing bundleId" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        let updateQuery = supabase
          .from("bundles")
          .update({ locked: true })
          .eq("bundle_id", bundleId);

        if (userId) {
          updateQuery = updateQuery.or(`user_id.eq.${userId},user_id.is.null`);
        }

        const { error } = await updateQuery;

        if (error) throw error;

        return new Response(
          JSON.stringify({ ok: true, locked: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "clear": {
        if (!bundleId) {
          return new Response(
            JSON.stringify({ ok: false, error: "Missing bundleId" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        let bundleQuery = supabase
          .from("bundles")
          .select("id")
          .eq("bundle_id", bundleId);

        if (userId) {
          bundleQuery = bundleQuery.or(`user_id.eq.${userId},user_id.is.null`);
        }

        const { data: bundle } = await bundleQuery.maybeSingle();

        if (bundle) {
          await supabase
            .from("bundle_documents")
            .delete()
            .eq("bundle_id", bundle.id);

          await supabase
            .from("bundles")
            .update({ locked: false })
            .eq("id", bundle.id);
        }

        return new Response(
          JSON.stringify({ ok: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ ok: false, error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Bundle error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
