import type { ReactElement } from "react";
import { Link, matchPath, useLocation } from "react-router";

interface IntakeStep {
  readonly label: string;
  readonly path: string;
  readonly stepNumber: number;
}

const intakeSteps: readonly IntakeStep[] = [
  { label: "Record", path: "/record", stepNumber: 1 },
  { label: "Topics", path: "/topics", stepNumber: 2 },
  { label: "Matches", path: "/matches", stepNumber: 3 },
];

export function ProgressIndicator(): ReactElement {
  const { pathname } = useLocation();
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
          const isCurrentStep = step.path === currentStep?.path;

          return (
            <li key={step.path}>
              <Link
                aria-current={isCurrentStep ? "step" : undefined}
                aria-label={`Step ${step.stepNumber} of ${intakeSteps.length}: ${step.label}`}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-2 text-center text-xs font-semibold outline-offset-4 transition-colors focus-visible:outline-2 focus-visible:outline-focus sm:min-h-14 sm:flex-row sm:justify-start sm:gap-3 sm:px-5 sm:py-3 sm:text-left sm:text-sm ${
                  isCurrentStep
                    ? "border-primary-600 bg-primary-600 text-white"
                    : "border-primary-300 bg-white text-primary-600 hover:bg-primary-200"
                }`}
                to={step.path}
              >
                <span
                  aria-hidden="true"
                  className={`grid size-7 shrink-0 place-items-center rounded-full text-xs ${
                    isCurrentStep
                      ? "bg-white text-primary-600"
                      : "bg-primary-200 text-primary-600"
                  }`}
                >
                  {step.stepNumber}
                </span>
                <span className="min-w-0">{step.label}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
