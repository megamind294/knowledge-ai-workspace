import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SESSION_KEY } from "../../auth/demoSession";
import { renderAppRoutes } from "../../test/renderAppRoutes";

function renderRoute(initialEntry: string) {
  renderAppRoutes([initialEntry]);
}

describe("authentication preview", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("keeps unavailable sign-in methods disabled while allowing demo access", async () => {
    const user = userEvent.setup();
    renderRoute("/login");

    expect(
      screen.getByRole("heading", { name: /welcome back/i }),
    ).toBeVisible();
    expect(screen.getByLabelText(/email address/i)).toBeEnabled();
    expect(screen.getByLabelText(/^password$/i)).toBeEnabled();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /continue with google/i }),
    ).toBeDisabled();
    expect(screen.getByText(/google sign-in remains unavailable/i)).toBeVisible();
    expect(screen.getByRole("link", { name: /create account/i })).toHaveAttribute(
      "href",
      "/register",
    );

    await user.click(
      screen.getByRole("button", { name: /explore demo workspace/i }),
    );

    expect(window.localStorage.getItem(SESSION_KEY)).toBe("active");
    expect(
      await screen.findByRole("heading", { name: /dashboard/i }),
    ).toBeVisible();
  });

  it("renders a distinct registration preview without creating an account", () => {
    renderRoute("/register");

    expect(
      screen.getByRole("heading", { name: /create your account/i }),
    ).toBeVisible();
    expect(screen.getByLabelText(/full name/i)).toBeEnabled();
    expect(screen.getByLabelText(/email address/i)).toBeEnabled();
    expect(screen.getByLabelText(/^password$/i)).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /^create account$/i }),
    ).toBeDisabled();
    expect(screen.getByText(/does not create a real account/i)).toBeVisible();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
