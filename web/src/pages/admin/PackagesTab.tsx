import type {
  BillingInvoice,
  BillingWebhookEvent,
  CommercialRequestItem,
  SubscriptionAddonAdminItem,
  SubscriptionTenantUsage,
  TenantSubscription,
} from '../../services/admin.service';
import './PackagesTab.css';

type AdminPackageRow =
  | SubscriptionTenantUsage
  | TenantSubscription
  | BillingInvoice
  | BillingWebhookEvent
  | SubscriptionAddonAdminItem
  | CommercialRequestItem;

const PACKAGE_STATUS_OPTIONS = [
  'All statuses',
  'Active',
  'Pending',
  'Past due',
  'Cancelled',
] as const;

const PACKAGE_SCOPE_OPTIONS = [
  'All scopes',
  'Subscriptions',
  'Invoices',
  'Webhooks',
  'Add-ons',
  'Commercial requests',
] as const;

const PACKAGE_SORT_OPTIONS = [
  'Newest first',
  'Oldest first',
  'Tenant name',
] as const;

const EMPTY_ROWS: ReadonlyArray<AdminPackageRow> = [];

type PackagesTabProps = Record<string, unknown>;

export function PackagesTab(props: PackagesTabProps) {
  void props;
  const selectedStatus = PACKAGE_STATUS_OPTIONS[0];
  const selectedScope = PACKAGE_SCOPE_OPTIONS[0];
  const selectedSort = PACKAGE_SORT_OPTIONS[0];

  return (
    <div className="packages-tab">
      <header className="packages-tab__header">
        <div>
          <h2 className="packages-tab__title">Packages</h2>
          <p className="packages-tab__description">
            Review subscriptions, invoices, webhooks, add-ons, and commercial requests from one
            place.
          </p>
        </div>

        <div className="packages-tab__header-meta">
          <span className="packages-tab__badge">Admin only</span>
          <span className="packages-tab__badge packages-tab__badge--muted">
            {EMPTY_ROWS.length} records loaded
          </span>
        </div>
      </header>

      <section className="packages-tab__toolbar" aria-labelledby="packages-tab-filters-title">
        <h3 id="packages-tab-filters-title" className="packages-tab__section-title">
          Filters
        </h3>

        <div className="packages-tab__filters">
          <div className="packages-tab__field">
            <label className="packages-tab__label" htmlFor="packages-tab-status">
              Status
            </label>
            <select
              id="packages-tab-status"
              className="packages-tab__select"
              aria-label="Package status filter"
              defaultValue={selectedStatus}
            >
              {PACKAGE_STATUS_OPTIONS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="packages-tab__field">
            <label className="packages-tab__label" htmlFor="packages-tab-scope">
              Scope
            </label>
            <select
              id="packages-tab-scope"
              className="packages-tab__select"
              aria-label="Package scope filter"
              defaultValue={selectedScope}
            >
              {PACKAGE_SCOPE_OPTIONS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="packages-tab__field">
            <label className="packages-tab__label" htmlFor="packages-tab-sort">
              Sort
            </label>
            <select
              id="packages-tab-sort"
              className="packages-tab__select"
              aria-label="Package sort order"
              defaultValue={selectedSort}
            >
              {PACKAGE_SORT_OPTIONS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="packages-tab__grid" aria-label="Package administration summaries">
        <article className="packages-tab__panel">
          <h3 className="packages-tab__panel-title">Subscription usage</h3>
          <p className="packages-tab__panel-copy">
            SubscriptionTenantUsage and TenantSubscription records are surfaced here for review.
          </p>
          <div className="packages-tab__empty-state">No usage records available.</div>
        </article>

        <article className="packages-tab__panel">
          <h3 className="packages-tab__panel-title">Invoices</h3>
          <p className="packages-tab__panel-copy">
            BillingInvoice items will appear in this section with payment details.
          </p>
          <div className="packages-tab__empty-state">No invoices available.</div>
        </article>

        <article className="packages-tab__panel">
          <h3 className="packages-tab__panel-title">Webhooks</h3>
          <p className="packages-tab__panel-copy">
            BillingWebhookEvent activity is shown for recent billing events.
          </p>
          <div className="packages-tab__empty-state">No webhook events available.</div>
        </article>

        <article className="packages-tab__panel">
          <h3 className="packages-tab__panel-title">Add-ons</h3>
          <p className="packages-tab__panel-copy">
            SubscriptionAddonAdminItem rows keep add-on management in one place.
          </p>
          <div className="packages-tab__empty-state">No add-ons available.</div>
        </article>

        <article className="packages-tab__panel packages-tab__panel--wide">
          <h3 className="packages-tab__panel-title">Commercial requests</h3>
          <p className="packages-tab__panel-copy">
            CommercialRequestItem records are grouped here for approval workflows.
          </p>
          <div className="packages-tab__empty-state">No commercial requests available.</div>
        </article>
      </section>
    </div>
  );
}

export default PackagesTab;
