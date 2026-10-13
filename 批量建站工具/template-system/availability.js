/** Template identity is shared across domains for v2 packages. Batch uniqueness
 * is a (domain, template) pair, so two unrelated fields may share one visual
 * package while sites in the same field still use distinct templates. */
export function findTemplateOwner(sites, templateId, exceptSite, domainId) {
  if (!templateId || !domainId) return null;
  return (sites || []).find(site => site !== exceptSite && site.themeId === domainId && site.config?.templateId === templateId) || null;
}
