export type ModelNotFoundError = {
  title: string | "Model Not Found";
  status: string | "404";
  id: string;
  detail: string;
  code: string | "model_not_found";
};
