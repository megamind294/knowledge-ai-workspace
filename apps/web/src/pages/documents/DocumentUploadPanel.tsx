import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useRef, useState } from "react";
import { knowledgeQueryKeys } from "../../data/queryKeys";
import { useKnowledgeRepository } from "../../data/useKnowledgeRepository";
import { validateDocumentUpload } from "../../domain/documentUpload";
import type {
  DocumentUploadCandidate,
  IngestionProgressStage,
} from "../../domain/knowledge";

interface SelectedFileMetadata {
  file: File;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

export function DocumentUploadPanel() {
  const repository = useKnowledgeRepository();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submissionPendingRef = useRef(false);
  const [selectedFile, setSelectedFile] =
    useState<SelectedFileMetadata | null>(null);
  const [workspaceId, setWorkspaceId] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [progressStage, setProgressStage] =
    useState<IngestionProgressStage | null>(null);
  const isApi = repository.mode === "api";

  const workspacesQuery = useQuery({
    queryKey: knowledgeQueryKeys.workspaces,
    queryFn: () => repository.getWorkspaces(),
  });
  const collectionsQuery = useQuery({
    queryKey: knowledgeQueryKeys.collections(workspaceId),
    queryFn: () => repository.getCollections(workspaceId),
    enabled: Boolean(workspaceId),
  });
  const collections = collectionsQuery.data ?? [];

  const createDocument = useMutation({
    mutationFn: ({
      candidate,
      file,
    }: {
      candidate: DocumentUploadCandidate;
      file: File;
    }) =>
      isApi
        ? repository.ingestDocument(candidate, file, setProgressStage)
        : repository.createDocument(candidate),
    onSuccess: async (document) => {
      setSelectedFile(null);
      setValidationErrors([]);
      setProgressStage(null);
      if (!isApi) {
        setSuccessMessage(
          `${document.name} was added as a local preview. Simulated ingestion status: uploaded.`,
        );
      } else if (document.status === "indexed") {
        setSuccessMessage(`${document.name} is indexed and ready to search.`);
      } else if (document.status === "failed") {
        setSuccessMessage(
          `${document.name} was uploaded, but indexing failed. ${document.failureReason ?? "Retry ingestion from the document page."}`,
        );
      } else {
        setSuccessMessage(
          `${document.name} was uploaded. Current ingestion status: ${document.status}.`,
        );
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      const invalidations = [
        queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.documents }),
        queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.dashboard }),
        queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.workspaces }),
        queryClient.invalidateQueries({
          queryKey: knowledgeQueryKeys.workspace(document.workspaceId),
        }),
      ];
      if (document.collectionId) {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: knowledgeQueryKeys.collection(
              document.workspaceId,
              document.collectionId,
            ),
          }),
          queryClient.invalidateQueries({
            queryKey: knowledgeQueryKeys.collections(document.workspaceId),
          }),
        );
      }
      await Promise.all(invalidations);
    },
    onError: () => {
      setProgressStage(null);
      setSuccessMessage("");
      setValidationErrors([
        isApi
          ? "The document could not be uploaded and indexed. Try again."
          : "The local preview could not be created. Try again.",
      ]);
    },
    onSettled: () => {
      submissionPendingRef.current = false;
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionPendingRef.current) {
      return;
    }

    if (!selectedFile) {
      setSuccessMessage("");
      setValidationErrors(["Choose a document file."]);
      return;
    }

    const validation = validateDocumentUpload({
      ...selectedFile,
      workspaceId,
      collectionId: collectionId || null,
    });
    if (!validation.ok) {
      setSuccessMessage("");
      setValidationErrors(validation.errors.map((error) => error.message));
      return;
    }

    setValidationErrors([]);
    setSuccessMessage("");
    submissionPendingRef.current = true;
    createDocument.mutate({
      candidate: validation.candidate,
      file: selectedFile.file,
    });
  }

  return (
    <section className="rounded-2xl border border-indigo-300/20 bg-indigo-950/30 p-6">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">
          {isApi ? "Authenticated ingestion" : "Local simulation"}
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          {isApi ? "Upload and index a document" : "Add a document preview"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {isApi ? (
            <>
              TXT and Markdown files can be indexed up to 10 MiB. PDF and DOCX
              parsing are not available yet; those uploads will retain a safe,
              retryable ingestion state.
            </>
          ) : (
            <>
              PDF, TXT, Markdown, or DOCX up to 10 MiB. Only local metadata is
              used; no file bytes are uploaded, read, parsed, stored, or sent
              to AI in Day 2.
            </>
          )}
        </p>
      </div>

      <form className="mt-6 grid gap-5 lg:grid-cols-2" onSubmit={handleSubmit}>
        <label className="text-sm font-medium text-slate-200 lg:col-span-2">
          Document file
          <input
            accept=".pdf,.txt,.md,.docx"
            className="mt-2 block w-full rounded-xl border border-dashed border-white/20 bg-slate-950/70 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-300 file:px-3 file:py-2 file:font-semibold file:text-slate-950"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setSelectedFile(
                file
                  ? {
                      file,
                      name: file.name,
                      mimeType: file.type,
                      sizeBytes: file.size,
                    }
                  : null,
              );
              setValidationErrors([]);
              setSuccessMessage("");
            }}
            ref={fileInputRef}
            type="file"
          />
        </label>

        <label className="text-sm font-medium text-slate-200">
          Workspace
          <select
            className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-slate-100"
            disabled={workspacesQuery.isPending || createDocument.isPending}
            onChange={(event) => {
              setWorkspaceId(event.target.value);
              setCollectionId("");
              setValidationErrors([]);
              setSuccessMessage("");
            }}
            value={workspaceId}
          >
            <option value="">Choose a workspace</option>
            {(workspacesQuery.data ?? []).map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-200">
          Collection
          <select
            className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-slate-100"
            disabled={
              !workspaceId || collectionsQuery.isPending || createDocument.isPending
            }
            onChange={(event) => setCollectionId(event.target.value)}
            value={collectionId}
          >
            <option value="">No collection</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </select>
        </label>

        {validationErrors.length > 0 ? (
          <div
            className="rounded-xl border border-rose-300/20 bg-rose-950/30 px-4 py-3 text-sm text-rose-200 lg:col-span-2"
            role="alert"
          >
            <ul className="list-disc space-y-1 pl-5">
              {validationErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {successMessage ? (
          <p
            className="rounded-xl border border-emerald-300/20 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200 lg:col-span-2"
            role="status"
          >
            {successMessage}
          </p>
        ) : null}

        <div className="lg:col-span-2">
          <button
            className="rounded-xl bg-indigo-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={createDocument.isPending}
            type="submit"
          >
            {createDocument.isPending
              ? isApi
                ? progressStage === "metadata"
                  ? "Creating metadata…"
                  : progressStage === "upload"
                    ? "Uploading bytes…"
                    : progressStage === "index"
                      ? "Indexing document…"
                      : "Refreshing document status…"
                : "Creating local preview…"
              : isApi
                ? "Upload and index"
                : "Create local preview"}
          </button>
        </div>
      </form>
    </section>
  );
}
