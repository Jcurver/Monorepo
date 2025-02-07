/**
 * Get section div based on inner h3
 * @param titleName
 * @returns
 */
export const getQuestionBlock = (titleName: string | RegExp) => {
  return cy
    .findByRole("heading", {
      name: titleName,
    })
    .parent();
};
/** Use links on the left */
export const getLinkToSection = (sectionName: string | RegExp) => {
  return cy.findByRole("link", {
    name: sectionName,
  });
};

export const getContinueAsGuestButton = () => {
  return cy.findByRole("button", {
    name: /Continue as Guest|accounts\.continue_as_guest\.action|without email/i,
    timeout: 10000, // avoid flaky test when the page is still loading
  });
};

export const getCreateAccountButton = () => {
  return cy.findByRole("button", {
    name: /Continue with Account|accounts\.create_account\.action/i,
  });
};
