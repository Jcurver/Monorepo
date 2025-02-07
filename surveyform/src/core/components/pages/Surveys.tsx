import { getSurveyHomePath } from "~/surveys/helpers";
import Link from "next/link";
import { statuses } from "~/surveys/constants";
import { FormattedMessage } from "~/core/components/common/FormattedMessage";
import Image from "next/image";
import { getSurveyImageUrl } from "~/surveys/getSurveyImageUrl";
import { SurveyEditionDescription } from "@devographics/core-models";

const SurveyItem = ({ survey }: { survey: SurveyEditionDescription }) => {
  const { name, year, status } = survey;
  const imageUrl = getSurveyImageUrl(survey);
  return (
    <div>
      <div className="survey-item">
        <div className="survey-image">
          <Link href={getSurveyHomePath(survey)} className="survey-link">
            <div className="survey-image-inner">
              <Image
                priority={
                  typeof status !== "undefined" && [1, 2].includes(status)
                }
                width={300}
                height={200}
                src={imageUrl}
                alt={`${name} ${year}`}
                quality={100}
              />
            </div>
            <span className="survey-name">
              <span>
                {name} {year}
              </span>
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
};

const SurveyGroup = ({
  surveys,
  status,
}: {
  surveys: Array<SurveyEditionDescription>;
  status: string;
}) => {
  if (!status) throw new Error("SurveyGroup must receive a defined status");
  const filteredSurveys = surveys.filter((s) => s.status === statuses[status]);
  return (
    <div className="surveys-group">
      <h3 className="surveys-group-heading">
        <FormattedMessage id={`general.${status}_surveys`} />
      </h3>
      {filteredSurveys.length > 0 ? (
        filteredSurveys.map((survey) => (
          <SurveyItem key={survey.slug} survey={survey} />
        ))
      ) : (
        <div className={`surveys-none surveys-no${status}`}>
          <FormattedMessage id={`general.no_${status}_surveys`} />
        </div>
      )}
    </div>
  );
};

const Surveys = ({ surveys }: { surveys: Array<SurveyEditionDescription> }) => {
  return (
    <div className="surveys">
      {/* FIXME won't load useLocaleContext correctly... <LocaleSelector />*/}
      <SurveyGroup surveys={surveys} status={"open"} />
      <SurveyGroup surveys={surveys} status={"preview"} />
      <SurveyGroup surveys={surveys} status={"closed"} />
      {/*<Translators />*/}
    </div>
  );
};

export default Surveys;
