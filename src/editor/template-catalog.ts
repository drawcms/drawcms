/**
 * Metadata-only template entrypoint. It intentionally excludes document
 * builders so dashboards and menus do not download the editor model.
 */
export { GUIDED_TEMPLATE_ID, TEMPLATE_CATALOG } from "./document/template-catalog";
export type { TemplateCatalogEntry, TemplateId } from "./document/template-catalog";
