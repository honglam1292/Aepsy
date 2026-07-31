import { useId, useState, type ReactElement, type Ref } from "react";

import type { ProviderSummary } from "../domain/providerModels";

interface ProviderCardProps {
  readonly provider: ProviderSummary;
  readonly headingRef?: Ref<HTMLHeadingElement>;
}

function getInitials(displayName: string | null): string | null {
  if (displayName === null) {
    return null;
  }

  const nameParts = displayName.trim().split(/\s+/).filter(Boolean);
  const firstNamePart = nameParts[0];
  if (firstNamePart === undefined) {
    return null;
  }

  const firstInitial = Array.from(firstNamePart)[0];
  if (firstInitial === undefined) {
    return null;
  }

  const lastNamePart = nameParts.length > 1 ? nameParts.at(-1) : undefined;
  const lastInitial =
    lastNamePart === undefined ? undefined : Array.from(lastNamePart)[0];
  return `${firstInitial}${lastInitial ?? ""}`.toLocaleUpperCase();
}

function ProviderAvatar({
  avatarUrl,
  displayName,
}: {
  readonly avatarUrl: string | null;
  readonly displayName: string | null;
}): ReactElement {
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const initials = getInitials(displayName);
  const canShowAvatar =
    avatarUrl !== null && failedAvatarUrl !== avatarUrl;

  return (
    <div className="grid aspect-square w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-primary-200 text-primary-600 sm:w-24">
      {canShowAvatar ? (
        <img
          alt=""
          className="size-full object-cover"
          onError={() => setFailedAvatarUrl(avatarUrl)}
          src={avatarUrl}
        />
      ) : initials === null ? (
        <svg
          aria-hidden="true"
          className="size-8 sm:size-10"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.42 0-8 2.24-8 5v2h16v-2c0-2.76-3.58-5-8-5Z" />
        </svg>
      ) : (
        <span
          aria-hidden="true"
          className="font-serif text-xl font-semibold sm:text-2xl"
        >
          {initials}
        </span>
      )}
    </div>
  );
}

function formatExperience(yearsExperience: number): string {
  const unit = yearsExperience === 1 ? "year" : "years";
  return `${yearsExperience} ${unit} of experience`;
}

export function ProviderCard({
  provider,
  headingRef,
}: ProviderCardProps): ReactElement {
  const headingId = useId();
  const displayName = provider.displayName ?? "Psychologist profile";
  const hasSecondaryDetails =
    provider.yearsExperience !== null || provider.professionalTitle !== null;

  return (
    <article
      aria-labelledby={headingId}
      className="h-full overflow-hidden rounded-3xl border border-primary-200 bg-white shadow-sm"
    >
      <div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-4 p-5 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-6 sm:p-6">
        <ProviderAvatar
          avatarUrl={provider.avatarUrl}
          displayName={provider.displayName}
        />

        <div className="min-w-0 self-center">
          <h3
            className="rounded-sm font-serif text-2xl leading-tight text-primary-600 outline-offset-4 focus:outline-2 focus:outline-focus"
            id={headingId}
            ref={headingRef}
            tabIndex={-1}
          >
            {displayName}
          </h3>
          {provider.yearsExperience === null ? null : (
            <p className="mt-2 leading-6 text-grey-500">
              {formatExperience(provider.yearsExperience)}
            </p>
          )}
          {provider.professionalTitle === null ? null : (
            <p className="mt-1 leading-6 text-grey-500">
              {provider.professionalTitle}
            </p>
          )}
          {!hasSecondaryDetails ? (
            <p className="mt-2 leading-6 text-grey-500">
              Additional profile details aren’t available.
            </p>
          ) : null}
        </div>
      </div>

      {provider.highlights.length === 0 ? null : (
        <div className="border-t border-primary-200 px-5 py-4 sm:px-6">
          <ul
            aria-label="Profile highlights"
            className="flex flex-wrap gap-2"
          >
            {provider.highlights.map((highlight) => (
              <li
                className="rounded-full bg-primary-100 px-3 py-2 text-sm font-semibold leading-5 text-primary-600"
                key={highlight.key}
              >
                {highlight.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
