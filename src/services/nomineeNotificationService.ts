import { FoodItem, PendingNomineeApproval, Language } from '../types';

export interface EmailNotificationPayload {
  toEmail: string;
  nomineeName: string;
  userName: string;
  foodItemName: string;
  orderType: 'instant' | 'scheduled';
  scheduleDetails?: string;
  requestedAt: string;
  requestId: string;
}

const STORAGE_PENDING_APPROVALS = 'autofeast_pending_nominee_approvals';
const STORAGE_NOMINEE_EMAIL_LOG = 'autofeast_nominee_email_log';

export class NomineeNotificationService {
  /**
   * Load stored pending approvals from localStorage
   */
  public static getPendingApprovals(): PendingNomineeApproval[] {
    try {
      const data = localStorage.getItem(STORAGE_PENDING_APPROVALS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Save pending approvals to localStorage
   */
  public static savePendingApprovals(approvals: PendingNomineeApproval[]): void {
    try {
      localStorage.setItem(STORAGE_PENDING_APPROVALS, JSON.stringify(approvals));
    } catch (e) {
      console.warn('[NomineeNotificationService] Failed to save approvals:', e);
    }
  }

  /**
   * Create a new pending restricted order approval request & send Email notification
   */
  public static createApprovalRequest(
    foodItem: FoodItem,
    orderType: 'instant' | 'scheduled',
    userName: string,
    nomineeName: string,
    nomineeEmail: string,
    scheduleDetails?: { time: string; slotName: string; duration?: string; frequency?: string },
    userId?: string
  ): PendingNomineeApproval {
    const requestId = `NOM-REQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newRequest: PendingNomineeApproval = {
      id: requestId,
      foodItem,
      orderType,
      scheduleDetails,
      requestedAt: new Date().toISOString(),
      status: 'pending',
      nomineeEmail,
      nomineeName
    };

    const currentList = this.getPendingApprovals();
    currentList.unshift(newRequest);
    this.savePendingApprovals(currentList);

    // Sync to backend MongoDB API asynchronously
    fetch('/api/nominee/approval-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newRequest,
        userId: userId || 'user_karthik_001'
      })
    }).catch(err => console.warn('[NomineeNotificationService] Sync approval request error:', err));

    // Send Email notification to Nominee
    const schedStr = scheduleDetails ? `Slot: ${scheduleDetails.slotName} at ${scheduleDetails.time}` : undefined;
    this.sendNomineeEmailNotification({
      toEmail: nomineeEmail || `${nomineeName.toLowerCase().replace(/\s+/g, '')}@autofeast.app`,
      nomineeName,
      userName,
      foodItemName: foodItem.name,
      orderType,
      scheduleDetails: schedStr,
      requestedAt: new Date().toLocaleTimeString(),
      requestId
    });

    return newRequest;
  }

  /**
   * Sync approval requests from backend MongoDB
   */
  public static async fetchApprovalRequests(userId?: string): Promise<PendingNomineeApproval[]> {
    try {
      const uId = userId || 'user_karthik_001';
      const res = await fetch(`/api/nominee/approval-requests?userId=${uId}`);
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.requests)) {
        this.savePendingApprovals(data.requests);
        return data.requests;
      }
    } catch (e) {}
    return this.getPendingApprovals();
  }

  /**
   * Sync restricted items for user from backend MongoDB
   */
  public static async fetchRestrictedItemIds(userId?: string): Promise<string[]> {
    try {
      const uId = userId || 'user_karthik_001';
      const res = await fetch(`/api/nominee/restricted-items?userId=${uId}`);
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.restrictedFoodIds)) {
        return data.restrictedFoodIds;
      }
    } catch (e) {}
    return [];
  }

  /**
   * Toggle restricted food item persistence in backend MongoDB
   */
  public static async toggleRestrictedItemServer(
    userId: string,
    foodItemId: string,
    foodItemName?: string,
    category?: string
  ): Promise<string[]> {
    try {
      const res = await fetch('/api/nominee/restricted-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, foodItemId, foodItemName, category })
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.restrictedFoodIds)) {
        return data.restrictedFoodIds;
      }
    } catch (e) {}
    return [];
  }

  /**
   * Send Email Notification to Nominee (simulated email dispatch & log)
   */
  public static sendNomineeEmailNotification(payload: EmailNotificationPayload): void {
    const subject = `[AutoFeast Nominee Alert] Approval Needed for ${payload.foodItemName} requested by ${payload.userName}`;
    const emailBody = `
========================================================================
📧 AUTOFEAST EMAIL NOTIFICATION DISPATCHED TO NOMINEE
========================================================================
To: ${payload.nomineeName} <${payload.toEmail}>
Subject: ${subject}

Dear ${payload.nomineeName},

User "${payload.userName}" has attempted to order a restricted food item on AutoFeast:

  • Food Item: ${payload.foodItemName}
  • Order Type: ${payload.orderType === 'instant' ? 'Instant GPS Order' : 'Auto-Scheduled Order'}
  ${payload.scheduleDetails ? `• Schedule Time: ${payload.scheduleDetails}` : ''}
  • Request Time: ${payload.requestedAt}
  • Request ID: ${payload.requestId}

Action Required:
Please log into the AutoFeast App, enter your 4-Digit Nominee Security PIN, and choose to APPROVE or DENY this food request.

If you approve, the order will be placed automatically. If denied, the request will be cancelled.

Thank you,
AutoFeast Family Safety System
========================================================================
    `;

    console.log(emailBody);

    // Store log entry in localStorage for audit trace
    try {
      const logs = JSON.parse(localStorage.getItem(STORAGE_NOMINEE_EMAIL_LOG) || '[]');
      logs.unshift({ ...payload, subject, sentAt: new Date().toISOString() });
      localStorage.setItem(STORAGE_NOMINEE_EMAIL_LOG, JSON.stringify(logs.slice(0, 50)));
    } catch (e) {
      console.warn('Failed to record email log:', e);
    }
  }

  /**
   * Update request status (Approve or Deny) and sync to MongoDB backend
   */
  public static updateApprovalStatus(requestId: string, status: 'approved' | 'denied'): PendingNomineeApproval | null {
    const list = this.getPendingApprovals();
    const req = list.find(r => r.id === requestId);
    if (req) {
      req.status = status;
      this.savePendingApprovals(list);

      // Sync status update to backend MongoDB API
      fetch(`/api/nominee/approval-requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      }).catch(err => console.warn('[NomineeNotificationService] Sync request status error:', err));

      return req;
    }
    return null;
  }
}
