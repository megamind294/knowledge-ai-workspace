import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SESSION_KEY } from "../../auth/demoSession";
import {
  createFixtureKnowledgeRepository,
  type KnowledgeRepository,
} from "../../data/knowledgeRepository";
import { MAX_DOCUMENT_SIZE_BYTES } from "../../domain/documentUpload";
import type { DocumentUploadCandidate } from "../../domain/knowledge";
import { renderAppRoutes } from "../../test/renderAppRoutes";

function renderDocumentLibrary(repository: KnowledgeRepository) {
  window.localStorage.setItem(SESSION_KEY, "active");
  return renderAppRoutes(["/app/documents"], repository);
}

async function chooseTarget(
  user: ReturnType<typeof userEvent.setup>,
  workspace = "product-research",
  collection = "market-intelligence",
) {
  await screen.findByRole("option", {
    name: workspace === "product-research" ? "Product research" : "Client delivery",
  });
  await user.selectOptions(
    await screen.findByRole("combobox", { name: /workspace/i }),
    workspace,
  );
  await user.selectOptions(
    await screen.findByRole("combobox", { name: /collection/i }),
    collection,
  );
}

describe("validated local document upload preview", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("provides accessible file selection and honest supported-format guidance", async () => {
    renderDocumentLibrary(createFixtureKnowledgeRepository());

    expect(
      await screen.findByRole("heading", { name: /add a document preview/i }),
    ).toBeVisible();
    expect(screen.getByLabelText(/document file/i)).toHaveAttribute(
      "accept",
      ".pdf,.txt,.md,.docx",
    );
    expect(
      screen.getByText(/pdf, txt, markdown, or docx up to 10 mib/i),
    ).toBeVisible();
    expect(screen.getByText(/no file bytes are uploaded/i)).toBeVisible();
  });

  it("scopes collection choices to the selected workspace", async () => {
    const user = userEvent.setup();
    renderDocumentLibrary(createFixtureKnowledgeRepository());

    await screen.findByRole("option", { name: "Client delivery" });
    await user.selectOptions(
      await screen.findByRole("combobox", { name: /workspace/i }),
      "client-delivery",
    );

    const collection = await screen.findByRole("combobox", {
      name: /collection/i,
    });
    expect(collection).toHaveDisplayValue("No collection");
    expect(
      screen.getByRole("option", { name: "Onboarding" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Market intelligence" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    {
      file: new File(["plain text"], "disguised.pdf", { type: "text/plain" }),
      message: /selected file type does not match its extension/i,
    },
    {
      file: new File([new Uint8Array(MAX_DOCUMENT_SIZE_BYTES + 1)], "large.pdf", {
        type: "application/pdf",
      }),
      message: /no larger than 10 mib/i,
    },
  ])("prevents invalid local creation and reports $message", async ({ file, message }) => {
    const user = userEvent.setup();
    const repository = createFixtureKnowledgeRepository();
    renderDocumentLibrary(repository);
    await chooseTarget(user);
    await user.upload(screen.getByLabelText(/document file/i), file);

    await user.click(screen.getByRole("button", { name: /create local preview/i }));

    expect(await screen.findByText(message)).toBeVisible();
    expect(
      (await repository.getDocuments("product-research")).some(
        (document) => document.name === file.name,
      ),
    ).toBe(false);
  });

  it("creates one local preview, refreshes the library, and resets the file input", async () => {
    const user = userEvent.setup();
    const repository = createFixtureKnowledgeRepository({
      now: () => new Date("2026-08-30T00:00:00.000Z"),
    });
    renderDocumentLibrary(repository);
    await chooseTarget(user);
    const fileInput = screen.getByLabelText(/document file/i);
    await user.upload(
      fileInput,
      new File(["# Release notes"], "release-notes.md", {
        type: "text/markdown",
      }),
    );

    await user.click(screen.getByRole("button", { name: /create local preview/i }));

    expect(
      await screen.findByText(/release-notes.md was added as a local preview/i),
    ).toBeVisible();
    expect(await screen.findByText("release-notes.md")).toBeVisible();
    expect(fileInput).toHaveValue("");
    const created = (await repository.getDocuments("product-research")).filter(
      (document) => document.name === "release-notes.md",
    );
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      collectionId: "market-intelligence",
      status: "uploaded",
    });
  });

  it("prevents duplicate creation while a local preview is pending", async () => {
    const user = userEvent.setup();
    const baseRepository = createFixtureKnowledgeRepository();
    let releaseCreation: (() => void) | undefined;
    const pendingCreation = new Promise<void>((resolve) => {
      releaseCreation = resolve;
    });
    const repository = {
      ...baseRepository,
      async createDocument(candidate: DocumentUploadCandidate) {
        await pendingCreation;
        return baseRepository.createDocument(candidate);
      },
    } satisfies KnowledgeRepository;
    renderDocumentLibrary(repository);
    await chooseTarget(user);
    await user.upload(
      screen.getByLabelText(/document file/i),
      new File(["draft"], "pending.txt", { type: "text/plain" }),
    );

    const submit = screen.getByRole("button", { name: /create local preview/i });
    await user.dblClick(submit);
    expect(submit).toBeDisabled();
    releaseCreation?.();

    await waitFor(async () => {
      const created = (await baseRepository.getDocuments("product-research")).filter(
        (document) => document.name === "pending.txt",
      );
      expect(created).toHaveLength(1);
    });
  });

  it("uploads the selected bytes in API mode and reports indexing progress", async () => {
    const user = userEvent.setup();
    const baseRepository = createFixtureKnowledgeRepository();
    const ingestDocument = vi.fn(async (
      candidate: DocumentUploadCandidate,
      file: File,
      onProgress: (stage: string) => void,
    ) => {
      for (const stage of ["metadata", "upload", "index", "refresh"]) {
        onProgress(stage);
      }
      return {
        ...(await baseRepository.createDocument(candidate)),
        status: "indexed" as const,
      };
    });
    const repository = {
      ...baseRepository,
      mode: "api",
      ingestDocument,
    } as unknown as KnowledgeRepository;
    renderDocumentLibrary(repository);
    await chooseTarget(user);
    const file = new File(["durable source bytes"], "source.txt", {
      type: "text/plain",
    });
    await user.upload(screen.getByLabelText(/document file/i), file);

    await user.click(screen.getByRole("button", { name: /upload and index/i }));

    expect(await screen.findByText(/source.txt is indexed and ready to search/i)).toBeVisible();
    expect(ingestDocument).toHaveBeenCalledWith(
      expect.objectContaining({ name: "source.txt", sizeBytes: file.size }),
      file,
      expect.any(Function),
    );
    expect(screen.getByText(/txt and markdown files can be indexed/i)).toBeVisible();
    expect(screen.queryByText(/pdf, txt, markdown, or docx up to 10 mib/i)).not.toBeInTheDocument();
  });
});
