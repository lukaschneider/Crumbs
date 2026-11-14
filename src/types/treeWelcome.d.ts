export interface TreeWelcomeState {
  revision: number;
  hasFrame: boolean;
}

export type TreeWelcomeMethods = {
  init: () => TreeWelcomeState;
};

export type TreeWelcomeWebviewMethods = {
  selection: (state: TreeWelcomeState) => void;
};
