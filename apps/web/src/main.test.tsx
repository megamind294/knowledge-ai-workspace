import { render, screen } from "@testing-library/react";
import { App } from "./App";

describe("application foundation", () => {
  it("introduces the source-grounded workspace product", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: /turn trusted documents into a useful ai workspace/i,
      }),
    ).toBeVisible();
  });
});
