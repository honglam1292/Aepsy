import type { ReactElement } from "react";
import { Link, matchPath, useLocation } from "react-router";

import { useIntakeWorkflow } from "../../features/intake/application/useIntakeWorkflow";
import { canAccessIntakeStep } from "../../features/intake/domain/intakeProgress";
import type { IntakeStep } from "../../features/intake/domain/intakeProgress";

interface IntakeStepItem {
  readonly label: string;
  readonly path: string;
  readonly step: IntakeStep;
  readonly stepNumber: number;
}

const intakeSteps: readonly IntakeStepItem[] = [
  { label: "Record", path: "/record", step: "record", stepNumber: 1 },
  { label: "Topics", path: "/topics", step: "topics", stepNumber: 2 },
  { label: "Matches", path: "/matches", step: "matches", stepNumber: 3 },
];

export function ProgressIndicator(): ReactElement {
  const { pathname } = useLocation();
  const { state } = useIntakeWorkflow();
  const currentStep = intakeSteps.find(
    (step) => matchPath({ path: step.path, end: true }, pathname) !== null,
  );

  return (
    <nav aria-label="Intake progress">
      <p aria-live="polite" className="sr-only">
        {currentStep === undefined
          ? ""
          : `Step ${currentStep.stepNumber} of ${intakeSteps.length}: ${currentStep.label}`}
      </p>
      <ol className="grid grid-cols-3 gap-2 sm:gap-4">
        {intakeSteps.map((step) => {
          const isAvailable = canAccessIntakeStep(state, step.step);
          const isCurrentStep =
            isAvailable && step.path === currentStep?.path;
          const stepContent = (
            <>
              <span
                aria-hidden="true"
                className={`grid size-7 shrink-0 place-items-center rounded-full text-xs ${
                  isCurrentStep
                    ? "bg-white text-primary-600"
                    : isAvailable
                      ? "bg-primary-200 text-primary-600"
                      : "bg-grey-300 text-grey-500"
                }`}
              >
                {step.stepNumber}
              </span>
              <span className="min-w-0">
                <span className="block">{step.label}</span>
                {!isAvailable && (
                  <span className="block text-[0.65rem] font-medium">
                    Unavailable
                  </span>
                )}
              </span>
            </>
          );
          const stepClassName = `flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-2 text-center text-xs font-semibold outline-offset-4 transition-colors focus-visible:outline-2 focus-visible:outline-focus sm:min-h-14 sm:flex-row sm:justify-start sm:gap-3 sm:px-5 sm:py-3 sm:text-left sm:text-sm ${
            isCurrentStep
              ? "border-primary-600 bg-primary-600 text-white"
              : isAvailable
                ? "border-primary-300 bg-white text-primary-600 hover:bg-primary-200"
                : "cursor-not-allowed border-grey-300 bg-grey-200 text-grey-500"
          }`;

          return (
            <li key={step.path}>
              {isAvailable ? (
                <Link
                  aria-current={isCurrentStep ? "step" : undefined}
                  aria-label={`Step ${step.stepNumber} of ${intakeSteps.length}: ${step.label}`}
                  className={stepClassName}
                  to={step.path}
                >
                  {stepContent}
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className={stepClassName}
                >
                  <span className="sr-only">
                    {`Step ${step.stepNumber} of ${intakeSteps.length}: `}
                  </span>
                  {stepContent}
                  <span className="sr-only">
                    {step.step === "topics"
                      ? "until your voice note is ready"
                      : "until you select at least one topic"}
                  </span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
