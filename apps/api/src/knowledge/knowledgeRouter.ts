import { CreateCollectionRequestSchema, CreateDocumentRequestSchema, CreateWorkspaceRequestSchema, type ApiErrorResponse } from "@knowledge-ai/contracts";
import { Router, type Response } from "express";
import { requireAuth } from "../auth/requireAuth.js";
import { KnowledgeRepositoryError, type KnowledgeRepository } from "./knowledgeRepository.js";

function error(response: Response, status: number, code: ApiErrorResponse["error"]["code"], message: string) {
  response.status(status).json({ error: { code, message, requestId: response.locals.requestId as string } } satisfies ApiErrorResponse);
}
async function handle(response: Response, action: () => Promise<void>) {
  try { await action(); } catch (cause) {
    if (cause instanceof KnowledgeRepositoryError) {
      const status = cause.code === "NOT_FOUND" ? 404 : cause.code === "FORBIDDEN" ? 403 : 409;
      error(response,status,cause.code,cause.message); return;
    }
    throw cause;
  }
}
function parse<T>(response: Response, schema: { safeParse(value: unknown): {success:true;data:T}|{success:false} }, value: unknown): T | null {
  const parsed=schema.safeParse(value); if(!parsed.success) { error(response,400,"BAD_REQUEST","Request validation failed"); return null; } return parsed.data;
}

export function createKnowledgeRouter(options:{repository:KnowledgeRepository;accessTokenSecret:Uint8Array}) {
  const router=Router(); router.use(requireAuth(options.accessTokenSecret));
  router.get("/workspaces", async (req,res,next)=>{ try { res.json({workspaces:await options.repository.listWorkspaces(req.auth!.userId)}); } catch(e){next(e);} });
  router.post("/workspaces", async (req,res,next)=>{ const input=parse(res,CreateWorkspaceRequestSchema,req.body); if(!input)return; try { await handle(res,async()=>{res.status(201).json({workspace:await options.repository.createWorkspace(req.auth!.userId,input)});}); } catch(e){next(e);} });
  router.get("/workspaces/:workspaceId", async(req,res,next)=>{ try { const value=await options.repository.getWorkspace(req.auth!.userId,req.params.workspaceId!); if(!value)return error(res,404,"NOT_FOUND","Workspace not found"); res.json({workspace:value}); }catch(e){next(e);} });
  router.get("/workspaces/:workspaceId/collections", async(req,res,next)=>{ try { const values=await options.repository.listCollections(req.auth!.userId,req.params.workspaceId!); if(!values)return error(res,404,"NOT_FOUND","Workspace not found"); res.json({collections:values}); }catch(e){next(e);} });
  router.post("/workspaces/:workspaceId/collections", async(req,res,next)=>{ const input=parse(res,CreateCollectionRequestSchema,req.body); if(!input)return; try { await handle(res,async()=>{res.status(201).json({collection:await options.repository.createCollection(req.auth!.userId,req.params.workspaceId!,input)});}); }catch(e){next(e);} });
  router.get("/workspaces/:workspaceId/collections/:collectionId", async(req,res,next)=>{ try { const value=await options.repository.getCollection(req.auth!.userId,req.params.workspaceId!,req.params.collectionId!); if(!value)return error(res,404,"NOT_FOUND","Collection not found"); res.json({collection:value}); }catch(e){next(e);} });
  router.get("/workspaces/:workspaceId/documents", async(req,res,next)=>{ try { const values=await options.repository.listDocuments(req.auth!.userId,req.params.workspaceId!); if(!values)return error(res,404,"NOT_FOUND","Workspace not found"); res.json({documents:values}); }catch(e){next(e);} });
  router.post("/workspaces/:workspaceId/documents", async(req,res,next)=>{ const input=parse(res,CreateDocumentRequestSchema,req.body); if(!input)return; try { await handle(res,async()=>{res.status(201).json({document:await options.repository.createDocument(req.auth!.userId,req.params.workspaceId!,input)});}); }catch(e){next(e);} });
  router.get("/workspaces/:workspaceId/documents/:documentId", async(req,res,next)=>{ try { const value=await options.repository.getDocument(req.auth!.userId,req.params.workspaceId!,req.params.documentId!); if(!value)return error(res,404,"NOT_FOUND","Document not found"); res.json({document:value}); }catch(e){next(e);} });
  router.post("/workspaces/:workspaceId/documents/:documentId/retry", async(req,res,next)=>{ try { await handle(res,async()=>{res.json({document:await options.repository.retryDocument(req.auth!.userId,req.params.workspaceId!,req.params.documentId!)});}); }catch(e){next(e);} });
  return router;
}
