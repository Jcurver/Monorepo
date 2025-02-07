import {
  ResponseMongoCollection,
  processEmailOnUpdate,
} from "~/responses/model.server";
import { getSurveyResponseSchema } from "~/responses/schema.server";
import { fetchSurveyFromId } from "@devographics/core-models/server";
import { canModifyResponse } from "../permissions";
import { throwError } from "./errors";

/**
 * Save a survey response
 * @param root 
 * @param args 
 * @param context 
 * @returns 
 */
export const saveSurvey = async (root, args, context) => {
  const { currentUser } = context;
  let data = args?.input?.data;
  const _id = args.input.id;
  const Responses = ResponseMongoCollection();

  // fetch document from db
  const response = await Responses.findOne({ _id });
  // run permission check
  if (!response || response?.userId !== currentUser._id) {
    throwError({
      id: "app.validation_error",
      data: {
        break: true,
        errors: [
          {
            break: true,
            id: "error.not_allowed",
            message: "Sorry, you are not allowed to modify this document.",
            properties: { responseId: data._id },
          },
        ],
      },
    });
  }

  if (!response) throw new Error("TS") // just to please ts because throwError already has never return type
  if (!response.surveySlug) throw new Error("TS") // just to please ts because throwError already has never return type

  // do not allow to edit closed survey
  // (this replace canUpdate logic from vulcan that needs to be async here)
  const can = await canModifyResponse(response, currentUser)
  if (!can) throwError({
    id: "app.validation_error",
    data: {
      break: true,
      errors: [
        {
          break: true,
          id: "error.not_allowed",
          message: "Sorry, you are not allowed to modify this document.",
          properties: { responseId: data._id },
        },
      ],
    },
  });

  const survey = await fetchSurveyFromId(response.surveySlug);
  // @ts-ignore
  const schema = getSurveyResponseSchema(survey)

  // run all onUpdate callbacks
  for (const fieldName of Object.keys(schema)) {
    const field = schema[fieldName];
    const { onUpdate } = field;
    if (onUpdate) {
      data[fieldName] = await onUpdate({
        currentUser,
        document: response,
        data,
        context,
      });
    }
  }

  data = await processEmailOnUpdate(data, { document: response });

  // insert document
  const updatedDocument = await Responses.updateOne({ _id }, { $set: data });

  const mergedDocument = { ...document, ...data };
  return { data: mergedDocument };
};
