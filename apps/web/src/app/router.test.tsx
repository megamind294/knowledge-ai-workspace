import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { DemoSessionProvider } from "../auth/DemoSessionProvider";
import { AppRoutes } from "./router";

const SESSION_KEY = "knowledge-ai.demo-session";

function renderRoute(initialEntries: string[]) {
  render(
    <DemoSessionProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <AppRoutes />
      </MemoryRouter>
    </DemoSessionProvider>,
  );
}

describe("application routing", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("redirects an unauthenticated app route to login", async () => {
    renderRoute(["/app"]);

    expect(
      await screen.findByRole("heading", { name: /welcome back/i }),
    ).toBeVisible();
  });

  it("renders the dashboard for a persisted demo session", async () => {
    window.localStorage.setItem(SESSION_KEY, "active");

    renderRoute(["/app"]);

    expect(
      await screen.findByRole("heading", { name: /dashboard/i }),
    ).toBeVisible();
  });

  it("starts a clearly labelled demo session and returns to the requested route", async () => {
    const user = userEvent.setup();
    renderRoute(["/app"]);

    await user.click(
      await screen.findByRole("button", {
        name: /explore demo workspace/i,
      }),
    );

    expect(window.localStorage.getItem(SESSION_KEY)).toBe("active");
    expect(
      await screen.findByRole("heading", { name: /dashboard/i }),
    ).toBeVisible();
  });

  it("renders a recoverable not-found page for unknown routes", async () => {
    renderRoute(["/not-a-real-page"]);

    expect(
      await screen.findByRole("heading", { name: /page not found/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /return home/i }),
    ).toHaveAttribute("href", "/");
  });
});
