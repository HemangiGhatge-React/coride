import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./dialog";

function Harness({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      <Dialog
        open={open}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        title="Make Kari an Admin?"
        description="Admins can manage users."
      >
        <button>Cancel</button>
        <button data-autofocus>Confirm</button>
      </Dialog>
    </>
  );
}

const opener = () => screen.getByRole("button", { name: "Open dialog" });

describe("Dialog", () => {
  it("is a labelled, described modal dialog, and renders nothing while closed", async () => {
    render(<Harness />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(opener());
    const dialog = screen.getByRole("dialog", { name: "Make Kari an Admin?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("Admins can manage users.");
  });

  it("moves focus inside on open (to the data-autofocus element)", async () => {
    render(<Harness />);
    await userEvent.click(opener());
    expect(screen.getByRole("button", { name: "Confirm" })).toHaveFocus();
  });

  it("traps Tab and Shift+Tab inside the dialog", async () => {
    render(<Harness />);
    await userEvent.click(opener());
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Confirm" });

    expect(confirm).toHaveFocus();
    await userEvent.tab(); // last -> wraps to first
    expect(cancel).toHaveFocus();
    await userEvent.tab({ shift: true }); // first -> wraps to last
    expect(confirm).toHaveFocus();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
    expect(opener()).not.toHaveFocus();
  });

  it("closes on Esc and returns focus to the trigger", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(opener());
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener()).toHaveFocus();
  });

  it("closes when the backdrop is clicked, but not when the panel is", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(opener());

    await userEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("dialog").parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(opener()).toHaveFocus();
  });

  it("locks page scrolling while open and restores it after", async () => {
    render(<Harness />);
    await userEvent.click(opener());
    expect(document.body.style.overflow).toBe("hidden");
    await userEvent.keyboard("{Escape}");
    expect(document.body.style.overflow).toBe("");
  });
});
