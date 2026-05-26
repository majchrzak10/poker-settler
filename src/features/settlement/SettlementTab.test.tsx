// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettlementTab } from './SettlementTab';

const players = [{ id: 'a', name: 'Anna', phone: '', email: '', linked_user_id: null }];

function renderTab(overrides: Partial<Parameters<typeof SettlementTab>[0]> = {}) {
  return render(
    <SettlementTab
      players={players}
      sessionPlayers={[{ playerId: 'a', buyIns: [50], cashOut: '' }]}
      transactions={[]}
      settled={false}
      totalPot={50}
      onSetCashOut={vi.fn()}
      onCalculate={vi.fn()}
      onResetSession={vi.fn()}
      onSaveAndFinish={vi.fn()}
      savingSession={false}
      saveStatus={null}
      {...overrides}
    />,
  );
}

describe('<SettlementTab>', () => {
  it('renders cash-out input with decimal inputMode and aria-label', () => {
    const { container } = renderTab();
    const input = container.querySelector('input[aria-label^="Cash-out dla"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.getAttribute('inputmode')).toBe('decimal');
  });

  it('forwards raw value (with polish comma) to onSetCashOut', () => {
    const onSetCashOut = vi.fn();
    const { container } = renderTab({ onSetCashOut });
    const input = container.querySelector('input[aria-label^="Cash-out dla"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '75,5' } });
    expect(onSetCashOut).toHaveBeenCalledWith('a', '75,5');
  });

  it('shows empty-state when no players in session', () => {
    renderTab({ sessionPlayers: [] });
    expect(screen.getByText(/Brak aktywnej sesji/i)).toBeTruthy();
  });

  it('uses "Oblicz mimo różnicy" label when pot is unbalanced', () => {
    renderTab({ sessionPlayers: [{ playerId: 'a', buyIns: [50], cashOut: '0' }] });
    expect(screen.getAllByText(/Oblicz mimo różnicy/).length).toBeGreaterThan(0);
  });
});
