import { BusinessTemplate } from '@dozbyte/shared';
import hospitalJson from '../templates/hospital.json' with { type: 'json' };

/** Every template shipped with this app version, checked against the schema at load time. */
export const templates = {
  hospital: BusinessTemplate.parse(hospitalJson),
} as const;

export type TemplateKey = keyof typeof templates;

export function getTemplate(key: TemplateKey): BusinessTemplate {
  return templates[key];
}
