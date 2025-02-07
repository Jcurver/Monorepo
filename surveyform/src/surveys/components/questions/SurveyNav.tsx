/*

1. Show list of sections
2. For each section, compare section questions with current response document
3. Figure out completion percentage

TODO

- Simplify this by using already-parsed with getQuestionObject() outline

*/
import { useFormContext } from "@devographics/react-form";
import Link from "next/link";
import { useState, useEffect } from "react";
import { getSurveyHomePath } from "~/surveys/helpers";
import type { SurveyEdition } from "@devographics/core-models";
import { FormattedMessage } from "~/core/components/common/FormattedMessage";
import SurveyNavItem from "~/surveys/components/questions/SurveyNavItem";
import { getCompletionPercentage } from "~/responses/helpers";
import { Button } from "~/core/components/ui/Button";
import { Loading } from "~/core/components/ui/Loading";

// TODO
// const getOverallCompletionPercentage = (response) => {

// }

const SurveyNav = ({
  survey,
  // response,
  navLoading,
  setNavLoading,
  readOnly,
}: {
  survey: SurveyEdition;
  // response?: any;
  navLoading?: boolean;
  setNavLoading?: any;
  readOnly?: boolean;
}) => {
  const formContext = useFormContext();
  const { getDocument } = formContext;

  const response = getDocument();

  const outline = survey.outline; //surveys.find((o) => o.slug === survey.slug)?.outline;
  if (!outline)
    throw new Error(`Survey or outline not found for slug ${survey.slug}`);

  const [shown, setShown] = useState(false);
  const [currentTabindex, setCurrentTabindex] = useState<number | null>(null);
  const [currentFocusIndex, setCurrentFocusIndex] = useState<number | null>(
    null
  );

  const overallCompletion =
    !readOnly && response && getCompletionPercentage(response, survey);

  useEffect(() => {
    const keyPressHandler = (e) => {
      if (currentFocusIndex !== null) {
        if (currentTabindex === null) {
          /*throw new Error(
            `currentFocusIndex was not null, but currentTabindex was null during keypress`
          );*/
          console.error(
            `currentFocusIndex was not null, but currentTabindex was null during keypress`
          );
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setCurrentTabindex(currentTabindex - 1);
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setCurrentTabindex(currentTabindex + 1);
        }
      }
    };
    document.addEventListener("keydown", keyPressHandler);
    return () => {
      document.removeEventListener("keydown", keyPressHandler);
    };
  }, [currentFocusIndex]);

  return (
    <nav
      className={`section-nav ${
        shown ? "section-nav-shown" : "section-nav-hidden"
      }`}
      aria-label={`${survey.name} ${survey.year}`}
    >
      <div className="section-nav-inner">
        <h2 className="section-nav-heading">
          <Link href={getSurveyHomePath(survey)}>
            {survey.name} {survey.year}
          </Link>
        </h2>
        <Button
          className="section-nav-head"
          onClick={(e) => {
            setShown(!shown);
          }}
        >
          <span className="section-nav-head-left">
            <h3 className="section-nav-toc">
              <FormattedMessage id="general.table_of_contents" />
            </h3>
            {overallCompletion && (
              <span className="section-nav-completion">
                {overallCompletion}%
              </span>
            )}
          </span>
          <span className="section-nav-toggle">{shown ? "▼" : "▶"}</span>
        </Button>
        <div className="section-nav-contents">
          <ul>
            {outline.map((section, i) => (
              <SurveyNavItem
                survey={survey}
                setShown={setShown}
                response={response}
                section={section}
                number={i + 1}
                key={i}
                currentTabindex={currentTabindex}
                setCurrentTabindex={setCurrentTabindex}
                setCurrentFocusIndex={setCurrentFocusIndex}
                setNavLoading={setNavLoading}
                readOnly={readOnly}
              />
            ))}
            {/* {response && <li>Overall: {getOverallCompletionPercentage(response)}%</li>} */}
          </ul>
          <p className="completion-message">
            <FormattedMessage id="general.all_questions_optional" />
          </p>
        </div>
        {navLoading && (
          <div className="section-nav-loading">
            <Loading />
          </div>
        )}
      </div>
    </nav>
  );
};

export default SurveyNav;
