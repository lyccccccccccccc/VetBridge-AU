"use client";

import type { ReferralStatus, UserRole } from "@vetbridge/domain";
import { useCallback, useEffect, useMemo, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:3001";

type Organisation = {
  id: string;
  name: string;
  type: "REFERRING_CLINIC" | "RECEIVING_HOSPITAL";
};

type Identity = {
  id: string;
  displayName: string;
  email: string;
  memberships: {
    organisationId: string;
    role: UserRole;
    organisation: Organisation;
  }[];
};

type Animal = {
  id: string;
  name: string;
  species: "DOG" | "CAT";
  breed: string;
  sex: string;
  desexed: boolean;
  dateOfBirth: string;
};

type ReferralSummary = {
  id: string;
  displayId: string;
  animal: Animal;
  status: ReferralStatus;
  priority: string;
  lastUpdatedAt: string;
  pendingDocumentFacts: number;
};

type ReviewOutcome = "APPROVED" | "CORRECTED" | "REJECTED";

type Encounter = {
  id: string;
  organisationId: string;
  occurredAt: string;
  summary: string;
  observations: {
    id: string;
    name: string;
    value: string | number;
    unit?: string;
  }[];
  diagnosticResults: {
    id: string;
    name: string;
    value: string | number;
    unit: string | null;
    referenceRange: string | null;
    observedAt: string;
  }[];
  conditions: {
    id: string;
    display: string;
    clinicalStatus: string;
    recordedAt: string;
  }[];
  medicationRecords: {
    id: string;
    name: string;
    instructions: string;
    startsAt: string;
    endsAt: string | null;
    enteredByClinician: boolean;
  }[];
};

type FollowUpAlert = {
  id: string;
  status: "REVIEW_REQUIRED" | "ACKNOWLEDGED" | "RESOLVED";
  triggerReasons: string[];
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  clinicalDisclaimer: string;
};

type ReferralDetail = ReferralSummary & {
  owner: { id: string; displayName: string; email: string };
  reason: string;
  submittedAt: string | null;
  referringOrganisation: Organisation;
  receivingOrganisation: Organisation;
  currentIdentity: {
    id: string;
    displayName: string;
    roles: UserRole[];
  };
  availableTransitions: ReferralStatus[];
  permissions: { canReviewDocuments: boolean };
  statusEvents: {
    id: string;
    fromStatus: ReferralStatus | null;
    toStatus: ReferralStatus;
    changedByName: string;
    reason: string | null;
    occurredAt: string;
  }[];
  auditEvents: {
    id: string;
    actorName: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
    occurredAt: string;
  }[];
  documents: {
    id: string;
    filename: string;
    mimeType: string;
    status:
      | "UPLOADED"
      | "QUEUED"
      | "PROCESSING"
      | "READY_FOR_REVIEW"
      | "APPROVED"
      | "FAILED";
    uploadedByName: string;
    uploadedAt: string;
    facts: {
      id: string;
      factType: string;
      candidateValue: string;
      confidence: number;
      sourcePage: number;
      sourceSection: string;
      modelVersion: string;
      review: null | {
        reviewerName: string;
        outcome: ReviewOutcome;
        correctedValue: string | null;
        reviewedAt: string;
      };
    }[];
    processingJobs?: {
      id: string;
      status: "QUEUED" | "PROCESSING" | "READY_FOR_REVIEW" | "FAILED";
      attempt: number;
      completedAt: string | null;
    }[];
  }[];
  clinicalRecord: {
    encounters: Encounter[];
    informationRequests: {
      id: string;
      message: string;
      requestedAt: string;
      resolvedAt: string | null;
    }[];
    dischargePlans: {
      id: string;
      clinicalSummary: string;
      ownerInstructions: string;
      approvedAt: string;
      approvedByName: string;
    }[];
    followUpPlans: {
      id: string;
      contactInstructions: string;
      startsAt: string;
      endsAt: string;
      submissions: {
        id: string;
        answers: Record<string, string>;
        imageStorageKey: string | null;
        submittedAt: string;
        alerts: FollowUpAlert[];
      }[];
    }[];
  };
};

type WorkspaceTab =
  | "overview"
  | "clinical"
  | "documents"
  | "handover"
  | "follow-up"
  | "audit";

function prettyText(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | null): string {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter((part) => !["Dr", "Mr", "Ms"].includes(part))
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

async function apiRequest<T>(
  path: string,
  userId?: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(userId ? { "x-demo-user": userId } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(payload?.message)
      ? payload.message.join(", ")
      : payload?.message;
    throw new Error(message ?? `Request failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export default function HomePage() {
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [identityId, setIdentityId] = useState("user-maya-chen");
  const [referrals, setReferrals] = useState<ReferralSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>("referral-a");
  const [detail, setDetail] = useState<ReferralDetail | null>(null);
  const [tab, setTab] = useState<WorkspaceTab>("overview");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [corrections, setCorrections] = useState<Record<string, string>>({});

  const identity = useMemo(
    () => identities.find((candidate) => candidate.id === identityId) ?? null,
    [identities, identityId],
  );

  const loadReferrals = useCallback(async () => {
    const list = await apiRequest<ReferralSummary[]>("/referrals", identityId);
    setReferrals(list);
    setSelectedId((current) => {
      if (current && list.some((item) => item.id === current)) return current;
      return list[0]?.id ?? null;
    });
  }, [identityId]);

  const loadDetail = useCallback(async () => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    const item = await apiRequest<ReferralDetail>(
      `/referrals/${selectedId}`,
      identityId,
    );
    setDetail(item);
  }, [identityId, selectedId]);

  useEffect(() => {
    apiRequest<Identity[]>("/demo/identities")
      .then(setIdentities)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "API unavailable"),
      );
  }, []);

  useEffect(() => {
    setError(null);
    setNotice(null);
    Promise.all([loadReferrals(), loadDetail()]).catch((reason: unknown) => {
      setDetail(null);
      setError(
        reason instanceof Error ? reason.message : "Unable to load data",
      );
    });
  }, [loadDetail, loadReferrals]);

  async function transition(to: ReferralStatus) {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiRequest<ReferralDetail>(
        `/referrals/${detail.id}/transitions`,
        identityId,
        {
          method: "POST",
          body: JSON.stringify({
            to,
            reason: `Demo action completed by ${identity?.displayName ?? "clinician"}`,
          }),
        },
      );
      setDetail(updated);
      await loadReferrals();
      setNotice(`Referral moved to ${prettyText(to)} and audit log updated.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function reviewFact(
    documentId: string,
    factId: string,
    outcome: ReviewOutcome,
  ) {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiRequest<ReferralDetail>(
        `/documents/${documentId}/facts/${factId}/review`,
        identityId,
        {
          method: "POST",
          body: JSON.stringify({
            outcome,
            correctedValue:
              outcome === "CORRECTED" ? corrections[factId] : undefined,
          }),
        },
      );
      setDetail(updated);
      await loadReferrals();
      setNotice(`AI-extracted fact marked ${prettyText(outcome)}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Review failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadDocument(file: File) {
    if (!detail) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await fetch(
        `${API_URL}/referrals/${detail.id}/documents`,
        {
          method: "POST",
          headers: { "x-demo-user": identityId },
          body: form,
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        referral?: ReferralDetail;
        message?: string | string[];
      } | null;
      if (!response.ok) {
        const message = Array.isArray(payload?.message)
          ? payload.message.join(", ")
          : payload?.message;
        throw new Error(message ?? `Upload failed with ${response.status}`);
      }
      if (payload?.referral) setDetail(payload.referral);
      setNotice(
        "Document stored and queued. Extracted facts will remain pending until clinician review.",
      );
      window.setTimeout(() => {
        void loadDetail().catch(() => undefined);
      }, 400);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function resetDemo() {
    setBusy(true);
    setError(null);
    await apiRequest("/demo/reset", undefined, { method: "POST" });
    await Promise.all([loadReferrals(), loadDetail()]);
    setNotice("Demo data restored to its original state.");
    setBusy(false);
  }

  async function resolveInformationRequest(requestId: string) {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiRequest<ReferralDetail>(
        `/referrals/${detail.id}/information-requests/${requestId}/resolve`,
        identityId,
        { method: "POST" },
      );
      setDetail(updated);
      await loadReferrals();
      setNotice("Requested information marked as supplied; audit log updated.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function actionFollowUpAlert(
    alertId: string,
    action: "ACKNOWLEDGE" | "RESOLVE",
  ) {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiRequest<ReferralDetail>(
        `/referrals/${detail.id}/follow-up-alerts/${alertId}/actions`,
        identityId,
        {
          method: "POST",
          body: JSON.stringify({ action }),
        },
      );
      setDetail(updated);
      setNotice(
        action === "ACKNOWLEDGE"
          ? "Follow-up alert acknowledged and recorded."
          : "Follow-up alert resolved and recorded.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const pendingFacts = referrals.reduce(
    (total, referral) => total + referral.pendingDocumentFacts,
    0,
  );
  const alerts = referrals.filter(
    (referral) => referral.status === "FOLLOW_UP_ACTIVE",
  ).length;

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">V</span>
          <div>
            <strong>VetBridge</strong>
            <small>AU</small>
          </div>
        </div>

        <nav aria-label="Primary">
          <button className="nav-link active" type="button">
            <span>Referral inbox</span>
            <b>{referrals.length}</b>
          </button>
          <button className="nav-link" type="button">
            <span>Create referral</span>
          </button>
          <button
            className={`nav-link ${tab === "documents" ? "active" : ""}`}
            onClick={() => setTab("documents")}
            type="button"
          >
            <span>Document review</span>
            <b>{pendingFacts}</b>
          </button>
          <button
            className={`nav-link ${tab === "follow-up" ? "active" : ""}`}
            onClick={() => {
              const alertReferral = referrals.find(
                (referral) => referral.status === "FOLLOW_UP_ACTIVE",
              );
              if (alertReferral) setSelectedId(alertReferral.id);
              setTab("follow-up");
            }}
            type="button"
          >
            <span>Follow-up alerts</span>
            <b>{alerts}</b>
          </button>
          <button
            className={`nav-link ${tab === "audit" ? "active" : ""}`}
            onClick={() => setTab("audit")}
            type="button"
          >
            <span>Audit events</span>
          </button>
        </nav>

        <section className="safety-note">
          <span>Clinical safety</span>
          <p>AI output remains a draft until a veterinarian approves it.</p>
        </section>

        <div className="profile">
          <span className="avatar">
            {identity ? initials(identity.displayName) : "—"}
          </span>
          <div>
            <strong>{identity?.displayName ?? "Loading identity"}</strong>
            <small>
              {identity?.memberships
                .map((membership) => prettyText(membership.role))
                .join(", ") ?? "Local demo"}
            </small>
          </div>
        </div>
      </aside>

      <section className="content">
        <header className="page-header">
          <div>
            <p className="eyebrow">SYNTHETIC CLINICAL DATA · LOCAL DEMO</p>
            <h1>Referral workspace</h1>
            <p>
              Operate a referral as either clinic and verify every human
              decision.
            </p>
          </div>
          <div className="header-actions">
            <label className="identity-select">
              <span>Acting as</span>
              <select
                aria-label="Select demo identity"
                onChange={(event) => setIdentityId(event.currentTarget.value)}
                value={identityId}
              >
                {identities.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.displayName} ·{" "}
                    {prettyText(candidate.memberships[0]!.role)}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="button secondary"
              disabled={busy}
              onClick={resetDemo}
              type="button"
            >
              Reset demo
            </button>
          </div>
        </header>

        {error && <div className="message error-message">{error}</div>}
        {notice && <div className="message success-message">{notice}</div>}

        <section className="metrics" aria-label="Referral summary">
          <article>
            <span>Visible referrals</span>
            <strong>{referrals.length}</strong>
            <small>Organisation access applied</small>
          </article>
          <article>
            <span>AI facts awaiting review</span>
            <strong>{pendingFacts}</strong>
            <small>Clinician decision required</small>
          </article>
          <article className="warning">
            <span>Follow-up alerts</span>
            <strong>{alerts}</strong>
            <small>Never triaged automatically</small>
          </article>
        </section>

        <section className="workspace-grid">
          <section className="panel referral-list">
            <div className="panel-heading">
              <div>
                <h2>Referral inbox</h2>
                <p>{identity?.memberships[0]?.organisation.name}</p>
              </div>
            </div>
            <div className="referral-items">
              {referrals.map((referral) => (
                <button
                  className={`referral-item ${
                    selectedId === referral.id ? "selected" : ""
                  }`}
                  key={referral.id}
                  onClick={() => {
                    setSelectedId(referral.id);
                    setTab("overview");
                  }}
                  type="button"
                >
                  <span className="pet-mark">{referral.animal.name[0]}</span>
                  <span className="referral-copy">
                    <span>
                      <strong>{referral.animal.name}</strong>
                      <small>{referral.displayId}</small>
                    </span>
                    <small>
                      {prettyText(referral.animal.species)} ·{" "}
                      {referral.animal.breed}
                    </small>
                    <em
                      className={`status status-${referral.status.toLowerCase()}`}
                    >
                      {prettyText(referral.status)}
                    </em>
                  </span>
                </button>
              ))}
              {!referrals.length && (
                <div className="empty-state">
                  <strong>No referrals visible</strong>
                  <p>
                    This proves the selected clinic cannot read another
                    organisation&apos;s records.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="panel case-panel">
            {!detail ? (
              <div className="empty-state large">
                <strong>Select an authorised referral</strong>
                <p>
                  Switch back to Dr Maya Chen or Dr Oliver Smith to continue the
                  Case A workflow.
                </p>
              </div>
            ) : (
              <>
                <div className="case-heading">
                  <div>
                    <span className="case-id">{detail.displayId}</span>
                    <h2>
                      {detail.animal.name} · {detail.animal.breed}
                    </h2>
                    <p>
                      {detail.referringOrganisation.name} →{" "}
                      {detail.receivingOrganisation.name}
                    </p>
                  </div>
                  <em
                    className={`status status-${detail.status.toLowerCase()}`}
                  >
                    {prettyText(detail.status)}
                  </em>
                </div>

                <div className="tabs" role="tablist">
                  {(
                    [
                      "overview",
                      "clinical",
                      "documents",
                      "handover",
                      "follow-up",
                      "audit",
                    ] as const
                  ).map((tabName) => (
                    <button
                      aria-selected={tab === tabName}
                      className={tab === tabName ? "selected" : ""}
                      key={tabName}
                      onClick={() => setTab(tabName)}
                      role="tab"
                      type="button"
                    >
                      {prettyText(tabName)}
                      {tabName === "documents" &&
                        ` (${detail.documents.reduce(
                          (total, document) =>
                            total +
                            document.facts.filter(
                              (fact) => fact.review === null,
                            ).length,
                          0,
                        )})`}
                    </button>
                  ))}
                </div>

                {tab === "overview" && (
                  <Overview
                    busy={busy}
                    detail={detail}
                    onTransition={transition}
                  />
                )}
                {tab === "documents" && (
                  <Documents
                    busy={busy}
                    corrections={corrections}
                    detail={detail}
                    onCorrection={(factId, value) =>
                      setCorrections((current) => ({
                        ...current,
                        [factId]: value,
                      }))
                    }
                    onReview={reviewFact}
                    onUpload={uploadDocument}
                  />
                )}
                {tab === "clinical" && <ClinicalRecord detail={detail} />}
                {tab === "handover" && (
                  <Handover
                    busy={busy}
                    detail={detail}
                    onResolveInformationRequest={resolveInformationRequest}
                  />
                )}
                {tab === "follow-up" && (
                  <FollowUp
                    busy={busy}
                    detail={detail}
                    onActionAlert={actionFollowUpAlert}
                  />
                )}
                {tab === "audit" && <AuditTrail detail={detail} />}
              </>
            )}
          </section>
        </section>
      </section>
    </main>
  );
}

function ClinicalRecord({ detail }: { detail: ReferralDetail }) {
  const organisations = new Map([
    [detail.referringOrganisation.id, detail.referringOrganisation.name],
    [detail.receivingOrganisation.id, detail.receivingOrganisation.name],
  ]);
  return (
    <div className="tab-content clinical-stack">
      {detail.clinicalRecord.encounters.map((encounter) => (
        <section className="clinical-card" key={encounter.id}>
          <div className="section-heading">
            <div>
              <h3>{organisations.get(encounter.organisationId) ?? "Clinic"}</h3>
              <small>{formatDate(encounter.occurredAt)}</small>
            </div>
            <span className="clinical-pill">
              {encounter.conditions[0]?.clinicalStatus ?? "recorded"}
            </span>
          </div>
          <p className="clinical-summary">{encounter.summary}</p>
          <div className="clinical-columns">
            <ClinicalGroup
              items={encounter.observations.map((item) => ({
                id: item.id,
                label: item.name,
                value: `${item.value}${item.unit ? ` ${item.unit}` : ""}`,
              }))}
              title="Observations"
            />
            <ClinicalGroup
              items={encounter.diagnosticResults.map((item) => ({
                id: item.id,
                label: item.name,
                value: `${item.value}${item.unit ? ` ${item.unit}` : ""}${
                  item.referenceRange
                    ? ` · ref ${item.referenceRange} ${item.unit ?? ""}`
                    : ""
                }`,
              }))}
              title="Diagnostics"
            />
            <ClinicalGroup
              items={encounter.conditions.map((item) => ({
                id: item.id,
                label: "Condition",
                value: `${item.display} · ${item.clinicalStatus}`,
              }))}
              title="Conditions"
            />
          </div>
          <div className="medication-section">
            <h4>Clinician-entered medication</h4>
            {encounter.medicationRecords.map((medication) => (
              <article key={medication.id}>
                <div>
                  <strong>{medication.name}</strong>
                  <p>{medication.instructions}</p>
                </div>
                <small>
                  {formatDate(medication.startsAt)} →{" "}
                  {formatDate(medication.endsAt)}
                </small>
              </article>
            ))}
            {!encounter.medicationRecords.length && (
              <p className="muted-copy">No medication recorded.</p>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function ClinicalGroup({
  items,
  title,
}: {
  items: { id: string; label: string; value: string }[];
  title: string;
}) {
  return (
    <section className="clinical-group">
      <h4>{title}</h4>
      {items.map((item) => (
        <div key={item.id}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
      {!items.length && <p className="muted-copy">None recorded.</p>}
    </section>
  );
}

function Handover({
  busy,
  detail,
  onResolveInformationRequest,
}: {
  busy: boolean;
  detail: ReferralDetail;
  onResolveInformationRequest: (requestId: string) => void;
}) {
  const referringUser = detail.currentIdentity.roles.includes("REFERRING_VET");
  return (
    <div className="tab-content clinical-stack">
      <section>
        <div className="section-heading">
          <h3>Information requests</h3>
          <small>
            {detail.clinicalRecord.informationRequests.length} requests
          </small>
        </div>
        {detail.clinicalRecord.informationRequests.map((request) => (
          <article className="handover-card" key={request.id}>
            <div>
              <span
                className={`status ${
                  request.resolvedAt ? "" : "status-pending"
                }`}
              >
                {request.resolvedAt ? "Supplied" : "Outstanding"}
              </span>
              <strong>{request.message}</strong>
              <small>Requested {formatDate(request.requestedAt)}</small>
            </div>
            {!request.resolvedAt && referringUser && (
              <button
                className="button"
                disabled={busy}
                onClick={() => onResolveInformationRequest(request.id)}
                type="button"
              >
                Mark supplied
              </button>
            )}
          </article>
        ))}
        {!detail.clinicalRecord.informationRequests.length && (
          <div className="empty-state">
            <strong>No outstanding information requests</strong>
          </div>
        )}
      </section>
      <section>
        <div className="section-heading">
          <h3>Approved discharge handover</h3>
          <small>{detail.clinicalRecord.dischargePlans.length} plans</small>
        </div>
        {detail.clinicalRecord.dischargePlans.map((plan) => (
          <article className="discharge-card" key={plan.id}>
            <span className="status">Clinician approved</span>
            <h4>{plan.clinicalSummary}</h4>
            <p>{plan.ownerInstructions}</p>
            <small>
              {plan.approvedByName} · {formatDate(plan.approvedAt)}
            </small>
          </article>
        ))}
        {!detail.clinicalRecord.dischargePlans.length && (
          <div className="empty-state">
            <strong>No discharge plan recorded yet</strong>
          </div>
        )}
      </section>
    </div>
  );
}

function FollowUp({
  busy,
  detail,
  onActionAlert,
}: {
  busy: boolean;
  detail: ReferralDetail;
  onActionAlert: (alertId: string, action: "ACKNOWLEDGE" | "RESOLVE") => void;
}) {
  const canAction = detail.currentIdentity.roles.includes(
    "RECEIVING_CLINICIAN",
  );
  return (
    <div className="tab-content clinical-stack">
      <div className="draft-banner">
        <strong>Human review required</strong>
        <p>
          Follow-up alerts are created by explicit routing rules. They are not a
          diagnosis or an urgency determination.
        </p>
      </div>
      {detail.clinicalRecord.followUpPlans.map((plan) => (
        <section className="follow-up-card" key={plan.id}>
          <div className="section-heading">
            <div>
              <h3>Owner follow-up plan</h3>
              <small>
                {formatDate(plan.startsAt)} → {formatDate(plan.endsAt)}
              </small>
            </div>
          </div>
          <p className="clinical-summary">{plan.contactInstructions}</p>
          {plan.submissions.map((submission) => (
            <article className="submission" key={submission.id}>
              <div className="submission-heading">
                <strong>Owner check-in</strong>
                <small>{formatDate(submission.submittedAt)}</small>
              </div>
              <dl>
                {Object.entries(submission.answers).map(
                  ([question, answer]) => (
                    <div key={question}>
                      <dt>{prettyText(question)}</dt>
                      <dd>{answer}</dd>
                    </div>
                  ),
                )}
              </dl>
              {submission.alerts.map((alert) => (
                <div className="alert-card" key={alert.id}>
                  <div>
                    <span className="status status-pending">
                      {prettyText(alert.status)}
                    </span>
                    <ul>
                      {alert.triggerReasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                    <small>{alert.clinicalDisclaimer}</small>
                  </div>
                  {canAction && alert.status !== "RESOLVED" && (
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() =>
                        onActionAlert(
                          alert.id,
                          alert.status === "REVIEW_REQUIRED"
                            ? "ACKNOWLEDGE"
                            : "RESOLVE",
                        )
                      }
                      type="button"
                    >
                      {alert.status === "REVIEW_REQUIRED"
                        ? "Acknowledge"
                        : "Resolve"}
                    </button>
                  )}
                </div>
              ))}
            </article>
          ))}
        </section>
      ))}
      {!detail.clinicalRecord.followUpPlans.length && (
        <div className="empty-state large">
          <strong>No follow-up plan active</strong>
          <p>
            A clinician-approved discharge plan can activate owner follow-up.
          </p>
        </div>
      )}
    </div>
  );
}

function Overview({
  busy,
  detail,
  onTransition,
}: {
  busy: boolean;
  detail: ReferralDetail;
  onTransition: (to: ReferralStatus) => void;
}) {
  return (
    <div className="tab-content">
      <section className="detail-grid">
        <article>
          <span>Referral reason</span>
          <p>{detail.reason}</p>
        </article>
        <article>
          <span>Patient</span>
          <p>
            {prettyText(detail.animal.species)},{" "}
            {detail.animal.sex.toLowerCase()},{" "}
            {detail.animal.desexed ? "desexed" : "not desexed"}
            <br />
            Born {detail.animal.dateOfBirth}
          </p>
        </article>
        <article>
          <span>Owner</span>
          <p>
            {detail.owner.displayName}
            <br />
            {detail.owner.email}
          </p>
        </article>
        <article>
          <span>Submitted</span>
          <p>{formatDate(detail.submittedAt)}</p>
        </article>
      </section>

      <section className="action-card">
        <div>
          <span>Available human decisions</span>
          <p>
            Actions are calculated from current state, organisation and role.
          </p>
        </div>
        <div className="action-buttons">
          {detail.availableTransitions.map((to) => (
            <button
              className="button"
              disabled={busy}
              key={to}
              onClick={() => onTransition(to)}
              type="button"
            >
              {prettyText(to)}
            </button>
          ))}
          {!detail.availableTransitions.length && (
            <small>No status action is permitted for this identity.</small>
          )}
        </div>
      </section>

      <section className="timeline">
        <div className="section-heading">
          <h3>Status history</h3>
          <small>{detail.statusEvents.length} recorded events</small>
        </div>
        {[...detail.statusEvents].reverse().map((event) => (
          <article key={event.id}>
            <i />
            <div>
              <strong>{prettyText(event.toStatus)}</strong>
              <p>{event.reason ?? "No reason supplied"}</p>
              <small>
                {event.changedByName} · {formatDate(event.occurredAt)}
              </small>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function Documents({
  busy,
  corrections,
  detail,
  onCorrection,
  onReview,
  onUpload,
}: {
  busy: boolean;
  corrections: Record<string, string>;
  detail: ReferralDetail;
  onCorrection: (factId: string, value: string) => void;
  onReview: (
    documentId: string,
    factId: string,
    outcome: ReviewOutcome,
  ) => void;
  onUpload: (file: File) => void;
}) {
  const canUpload = detail.currentIdentity.roles.some((role) =>
    ["REFERRING_VET", "RECEIVING_CLINICIAN"].includes(role),
  );
  return (
    <div className="tab-content">
      <div className="draft-banner">
        <strong>AI extraction is a draft</strong>
        <p>
          Source location and confidence are shown for review. AI cannot update
          the clinical record or referral status.
        </p>
      </div>
      {canUpload && (
        <label className="upload-card">
          <span>
            <strong>Attach a clinical record</strong>
            <small>PDF, JPEG or PNG · maximum 5 MB</small>
          </span>
          <input
            accept=".pdf,image/jpeg,image/png"
            disabled={busy}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) onUpload(file);
              event.currentTarget.value = "";
            }}
            type="file"
          />
        </label>
      )}
      {detail.documents.map((document) => (
        <section className="document-card" key={document.id}>
          <div className="document-heading">
            <div>
              <span>PDF</span>
              <div>
                <strong>{document.filename}</strong>
                <small>
                  Uploaded by {document.uploadedByName} ·{" "}
                  {formatDate(document.uploadedAt)}
                </small>
              </div>
            </div>
            <em
              className={`status ${
                document.status === "APPROVED" ? "" : "status-pending"
              }`}
            >
              {prettyText(document.status)}
            </em>
          </div>
          {document.processingJobs?.at(-1) &&
            document.processingJobs.at(-1)?.status !== "READY_FOR_REVIEW" && (
              <div className="processing-note">
                Processing job:{" "}
                {prettyText(document.processingJobs.at(-1)!.status)}
              </div>
            )}
          <div className="facts">
            {document.facts.map((fact) => (
              <article className="fact" key={fact.id}>
                <div className="fact-main">
                  <span>{fact.factType}</span>
                  <strong>
                    {fact.review?.correctedValue ?? fact.candidateValue}
                  </strong>
                  <small>
                    Page {fact.sourcePage} · {fact.sourceSection} ·{" "}
                    {Math.round(fact.confidence * 100)}% confidence
                  </small>
                </div>
                {fact.review ? (
                  <div className="reviewed">
                    <strong>{prettyText(fact.review.outcome)}</strong>
                    <small>
                      {fact.review.reviewerName} ·{" "}
                      {formatDate(fact.review.reviewedAt)}
                    </small>
                  </div>
                ) : detail.permissions.canReviewDocuments ? (
                  <div className="review-actions">
                    <input
                      aria-label={`Correction for ${fact.factType}`}
                      onChange={(event) =>
                        onCorrection(fact.id, event.currentTarget.value)
                      }
                      placeholder="Optional corrected value"
                      value={corrections[fact.id] ?? ""}
                    />
                    <div>
                      <button
                        className="button small"
                        disabled={busy}
                        onClick={() =>
                          onReview(document.id, fact.id, "APPROVED")
                        }
                        type="button"
                      >
                        Approve
                      </button>
                      <button
                        className="button small secondary"
                        disabled={busy || !corrections[fact.id]?.trim()}
                        onClick={() =>
                          onReview(document.id, fact.id, "CORRECTED")
                        }
                        type="button"
                      >
                        Save correction
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="reviewed pending">
                    <strong>Awaiting receiving clinician</strong>
                    <small>Read-only for your current role</small>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
      {!detail.documents.length && (
        <div className="empty-state large">
          <strong>No clinical documents attached</strong>
        </div>
      )}
    </div>
  );
}

function AuditTrail({ detail }: { detail: ReferralDetail }) {
  return (
    <div className="tab-content">
      <div className="section-heading">
        <h3>Immutable-style audit trail</h3>
        <small>{detail.auditEvents.length} events in this demo session</small>
      </div>
      <div className="audit-list">
        {[...detail.auditEvents].reverse().map((event) => (
          <article key={event.id}>
            <span className="audit-icon">✓</span>
            <div>
              <strong>{prettyText(event.action)}</strong>
              <p>
                {event.entityType} · {event.entityId}
              </p>
              <small>
                {event.actorName} · {formatDate(event.occurredAt)}
              </small>
            </div>
            <code>{JSON.stringify(event.metadata)}</code>
          </article>
        ))}
      </div>
    </div>
  );
}
