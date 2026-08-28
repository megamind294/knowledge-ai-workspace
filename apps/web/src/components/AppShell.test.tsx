import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SESSION_KEY } from "../auth/demoSession";
import { renderAppRoutes } from "../test/renderAppRoutes";

function renderAuthenticatedShell() {
  window.localStorage.setItem(SESSION_KEY, "active");

  renderAppRoutes(["/app"]);
}

describe("AppShell", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("provides accessible navigation and a skip link", async () => {
    renderAuthenticatedShell();

    expect(
      await screen.findByRole("link", { name: /skip to content/i }),
    ).toHaveAttribute("href", "#main-content");
    expect(
      screen.getByRole("navigation", { name: /primary navigation/i }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("Rinkle Sharma")).toBeVisible();
  });

  it("exposes an explicit mobile navigation toggle", async () => {
    const user = userEvent.setup();
    renderAuthenticatedShell();

    const toggle = await screen.findByRole("button", {
      name: /open navigation/i,
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("navigation", { name: /mobile navigation/i }),
    ).toBeVisible();
  });

  it("ends the demo session and returns to login", async () => {
    const user = userEvent.setup();
    renderAuthenticatedShell();

    await user.click(
      await screen.findByRole("button", { name: /sign out of demo/i }),
    );

    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(
      await screen.findByRole("heading", { name: /welcome back/i }),
    ).toBeVisible();
  });
});
