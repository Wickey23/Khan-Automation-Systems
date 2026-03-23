"use client";

import { useEffect } from "react";

type ShortcutBinding = {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  onTrigger: () => void;
};

type UseOperationalShortcutsParams = {
  enabled?: boolean;
  itemIds?: string[];
  focusedId?: string;
  setFocusedId?: (id: string) => void;
  onEnter?: () => void;
  bindings?: ShortcutBinding[];
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function matchesBinding(event: KeyboardEvent, binding: ShortcutBinding) {
  return (
    event.key.toLowerCase() === binding.key.toLowerCase() &&
    Boolean(binding.altKey) === event.altKey &&
    Boolean(binding.ctrlKey) === event.ctrlKey &&
    Boolean(binding.metaKey) === event.metaKey &&
    Boolean(binding.shiftKey) === event.shiftKey
  );
}

export function useOperationalShortcuts({
  enabled = true,
  itemIds = [],
  focusedId,
  setFocusedId,
  onEnter,
  bindings = []
}: UseOperationalShortcutsParams) {
  useEffect(() => {
    if (!enabled) return;

    function move(delta: number) {
      if (!itemIds.length || !setFocusedId) return;
      if (!focusedId) {
        setFocusedId(itemIds[0]);
        return;
      }
      const index = itemIds.indexOf(focusedId);
      const safeIndex = index < 0 ? 0 : index;
      const nextIndex = Math.max(0, Math.min(itemIds.length - 1, safeIndex + delta));
      setFocusedId(itemIds[nextIndex]);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;

      if (event.key === "ArrowDown" || event.key.toLowerCase() === "j") {
        event.preventDefault();
        move(1);
        return;
      }
      if (event.key === "ArrowUp" || event.key.toLowerCase() === "k") {
        event.preventDefault();
        move(-1);
        return;
      }
      if (event.key === "Enter" && onEnter) {
        event.preventDefault();
        onEnter();
        return;
      }

      for (const binding of bindings) {
        if (!matchesBinding(event, binding)) continue;
        event.preventDefault();
        binding.onTrigger();
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bindings, enabled, focusedId, itemIds, onEnter, setFocusedId]);
}

