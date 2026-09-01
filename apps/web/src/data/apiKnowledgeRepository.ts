import type { Collection, KnowledgeDocument, Workspace } from "@knowledge-ai/contracts";
import { ApiClientError, type ApiClient } from "../api/apiClient";
import type { CollectionSummary, DocumentDetail, DocumentMediaType, WorkspaceSummary } from "../domain/knowledge";
import type { KnowledgeRepository } from "./knowledgeRepository";

const mediaToUi:Record<KnowledgeDocument["mediaType"],DocumentMediaType>={"application/pdf":"pdf","text/plain":"text","text/markdown":"markdown","application/vnd.openxmlformats-officedocument.wordprocessingml.document":"docx"};
function doc(value:KnowledgeDocument):DocumentDetail { return {id:value.id,workspaceId:value.workspaceId,collectionId:value.collectionId,name:value.originalFilename,mediaType:mediaToUi[value.mediaType],status:value.ingestionState,sizeBytes:value.sizeBytes,failureReason:value.failureReason,createdAt:value.createdAt,updatedAt:value.updatedAt}; }
function missing(error:unknown){return error instanceof ApiClientError && error.code==="NOT_FOUND";}

export function createApiKnowledgeRepository(client:Pick<ApiClient,"request">):KnowledgeRepository {
  async function workspaces(){return (await client.request<{workspaces:Workspace[]}>("/api/workspaces")).workspaces;}
  async function collections(workspaceId:string){return (await client.request<{collections:Collection[]}>(`/api/workspaces/${workspaceId}/collections`)).collections;}
  async function documents(workspaceId:string){return (await client.request<{documents:KnowledgeDocument[]}>(`/api/workspaces/${workspaceId}/documents`)).documents;}
  async function workspaceSummary(value:Workspace):Promise<WorkspaceSummary>{const [cs,ds]=await Promise.all([collections(value.id),documents(value.id)]);return{id:value.id,name:value.name,description:value.description,role:value.role,collectionCount:cs.length,documentCount:ds.length,updatedAt:value.updatedAt};}
  async function collectionSummary(value:Collection):Promise<CollectionSummary>{const ds=(await documents(value.workspaceId)).filter(item=>item.collectionId===value.id);return{id:value.id,workspaceId:value.workspaceId,name:value.name,description:value.description,documentCount:ds.length,indexedDocumentCount:ds.filter(item=>item.ingestionState==="indexed").length,updatedAt:value.updatedAt};}
  async function allDocuments(){const ws=await workspaces();return (await Promise.all(ws.map(item=>documents(item.id)))).flat();}
  return {
    async getDashboard(){const ws=await workspaces();const [summaries,all]=await Promise.all([Promise.all(ws.map(workspaceSummary)),Promise.all(ws.map(item=>documents(item.id))).then(values=>values.flat())]);const allCollections=await Promise.all(ws.map(item=>collections(item.id))).then(values=>values.flat());return{metrics:{workspaces:ws.length,collections:allCollections.length,documents:all.length,indexedDocuments:all.filter(item=>item.ingestionState==="indexed").length},recentWorkspaces:summaries.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),recentDocuments:all.map(doc).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))};},
    async getWorkspaces(){return Promise.all((await workspaces()).map(workspaceSummary));},
    async getWorkspace(id){try{const value=(await client.request<{workspace:Workspace}>(`/api/workspaces/${id}`)).workspace;return workspaceSummary(value);}catch(error){if(missing(error))return null;throw error;}},
    async getCollections(workspaceId){return Promise.all((await collections(workspaceId)).map(collectionSummary));},
    async getCollection(workspaceId,collectionId){try{const value=(await client.request<{collection:Collection}>(`/api/workspaces/${workspaceId}/collections/${collectionId}`)).collection;return collectionSummary(value);}catch(error){if(missing(error))return null;throw error;}},
    async getDocuments(workspaceId,collectionId){return (await documents(workspaceId)).filter(item=>!collectionId||item.collectionId===collectionId).map(doc);},
    async getDocument(id){for(const value of await allDocuments())if(value.id===id)return doc(value);return null;},
    async createDocument(candidate){const response=await client.request<{document:KnowledgeDocument}>(`/api/workspaces/${candidate.workspaceId}/documents`,{method:"POST",body:JSON.stringify({collectionId:candidate.collectionId,originalFilename:candidate.name,mediaType:candidate.mimeType,sizeBytes:candidate.sizeBytes})});return doc(response.document);},
    async retryDocument(id){for(const value of await allDocuments()){if(value.id===id){const response=await client.request<{document:KnowledgeDocument}>(`/api/workspaces/${value.workspaceId}/documents/${id}/retry`,{method:"POST"});return doc(response.document);}}return null;},
  };
}
