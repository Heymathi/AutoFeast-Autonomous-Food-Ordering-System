import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NomineeApprovalWaitingModal } from '../components/NomineeApprovalWaitingModal';

// Mock AppContext
vi.mock('../context/AppContext', () => ({
  useApp: () => ({
    language: 'en',
    t: (key: string) => {
      const dict: Record<string, string> = {
        'nominee.waitingApproval': 'Waiting for nominee approval. We have sent an e-mail to your nominee.',
        'nominee.approved': 'Your nominee approved.',
        'nominee.denied': 'Your nominee did not approve this item.',
        'nominee.expired': 'No reply from your nominee yet',
        'nominee.sendReminder': 'Send reminder e-mail',
        'nominee.reminderSent': 'Reminder e-mail sent to your nominee.',
        'nominee.emailSendError': 'Could not send e-mail to the nominee, please try again.',
        'nominee.approvalRequiredBadge': 'Nominee Approval Required',
        'nominee.requestApprovalBtn': 'Request Nominee Approval',
        'nominee.cancelBtn': 'Cancel',
        'nominee.instantOrder': 'Instant Order',
        'nominee.scheduledOrder': 'Scheduled Order'
      };
      return dict[key] || key;
    },
    showToast: vi.fn(),
    speakText: vi.fn()
  })
}));

// Mock SpeechController
vi.mock('../services/speechController', () => ({
  SpeechController: {
    speak: vi.fn((_text, _lang, cb) => { if (cb) cb(); }),
    cancelSpeech: vi.fn(),
    acquireMic: vi.fn(),
    releaseMic: vi.fn()
  }
}));

describe('NomineeApprovalWaitingModal UI Component', () => {
  const dummyItem: any = {
    id: 'biryani-ambur',
    name: 'Ambur Mutton Biryani',
    basePrice: 280,
    restaurant: 'Star Ambur Biryani'
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders waiting screen with localized prompt and food item info', () => {
    render(
      <NomineeApprovalWaitingModal
        isOpen={true}
        onClose={vi.fn()}
        approvalId="APP-12345"
        foodItem={dummyItem}
        orderType="instant"
        onApproved={vi.fn()}
        onDenied={vi.fn()}
      />
    );

    expect(screen.getByText('Waiting for nominee approval. We have sent an e-mail to your nominee.')).toBeDefined();
    expect(screen.getByText(/Ambur Mutton Biryani/)).toBeDefined();
    expect(screen.getByText(/Instant Order/)).toBeDefined();
    expect(screen.getByText('Send reminder e-mail')).toBeDefined();
    expect(screen.getByText('Cancel')).toBeDefined();
  });

  it('handles Cancel button click and closes modal', async () => {
    const handleClose = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'pending' })
    } as any);

    render(
      <NomineeApprovalWaitingModal
        isOpen={true}
        onClose={handleClose}
        approvalId="APP-12345"
        foodItem={dummyItem}
        orderType="instant"
        onApproved={vi.fn()}
        onDenied={vi.fn()}
      />
    );

    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    expect(handleClose).toHaveBeenCalled();
  });

  it('polls status and calls onApproved when backend returns approved', async () => {
    const onApprovedMock = vi.fn();
    const onCloseMock = vi.fn();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'approved' })
    } as any);

    render(
      <NomineeApprovalWaitingModal
        isOpen={true}
        onClose={onCloseMock}
        approvalId="APP-12345"
        foodItem={dummyItem}
        orderType="instant"
        onApproved={onApprovedMock}
        onDenied={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(onApprovedMock).toHaveBeenCalledWith(dummyItem, 'instant', undefined);
      expect(onCloseMock).toHaveBeenCalled();
    });
  });

  it('polls status and calls onDenied when backend returns denied', async () => {
    const onDeniedMock = vi.fn();
    const onCloseMock = vi.fn();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'denied' })
    } as any);

    render(
      <NomineeApprovalWaitingModal
        isOpen={true}
        onClose={onCloseMock}
        approvalId="APP-12345"
        foodItem={dummyItem}
        orderType="instant"
        onApproved={vi.fn()}
        onDenied={onDeniedMock}
      />
    );

    await waitFor(() => {
      expect(onDeniedMock).toHaveBeenCalled();
      expect(onCloseMock).toHaveBeenCalled();
    });
  });

  it('sends reminder email on Send reminder button click', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true })
    } as any);

    render(
      <NomineeApprovalWaitingModal
        isOpen={true}
        onClose={vi.fn()}
        approvalId="APP-12345"
        foodItem={dummyItem}
        orderType="instant"
        onApproved={vi.fn()}
        onDenied={vi.fn()}
      />
    );

    const reminderBtn = screen.getByText(/Send reminder e-mail/);
    fireEvent.click(reminderBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/approvals/APP-12345/remind', expect.objectContaining({ method: 'POST' }));
    });
  });
});
