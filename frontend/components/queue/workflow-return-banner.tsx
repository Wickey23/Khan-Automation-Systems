import Link from "next/link";

type WorkflowReturnBannerProps = {
  returnTo: string | null;
  returnLabel: string;
};

export function WorkflowReturnBanner({ returnTo, returnLabel }: WorkflowReturnBannerProps) {
  if (!returnTo) return null;

  return (
    <div className="app-banner app-banner-primary text-xs">
      Opened from {returnLabel}.{" "}
      <Link href={returnTo} className="font-semibold text-blue-700 underline">
        Back to {returnLabel}
      </Link>
    </div>
  );
}
