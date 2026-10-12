// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (path: string) => ({ status: path === '/api/health' ? 200 : 401, json: async () => path === '/api/health' ? { status: 'ok' } : { error: 'No session' } })));
});

describe('learning UI', () => {
  it('shows all eight labs and marks findings as simulated', () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(screen.getAllByText('Security labs').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/SIMULATED/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Authentication & authorization').length).toBeGreaterThan(0);
  });
  it('saves quiz progress after the correct answer', () => {
    render(<MemoryRouter initialEntries={['/labs/sql-injection']}><App /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /B\. They keep input as data/ }));
    expect(screen.getByRole('status').textContent).toContain('Progress saved');
    expect(JSON.parse(localStorage.getItem('lab-completed') ?? '[]')).toContain('sql-injection');
  });
  it('renders XSS-looking text literally', () => {
    render(<MemoryRouter initialEntries={['/labs/xss']}><App /></MemoryRouter>);
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy();
    expect(document.querySelector('.safe-preview img')).toBeNull();
  });
});
