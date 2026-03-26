import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import ProfileForm from './ProfileForm';
import {I18nProvider} from '../../i18n/I18nProvider';
import {ToastProvider} from '../ToastProvider';
import {UnsavedChangesProvider} from '../../context/UnsavedChangesContext';

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json'}});
}

function pathnameOf(url: string) {
  try {
    return new URL(url, 'http://localhost').pathname;
  } catch {
    return url;
  }
}

function renderWithProviders(ui: React.ReactNode) {
  return render(
    <I18nProvider>
      <ToastProvider>
        <UnsavedChangesProvider>{ui}</UnsavedChangesProvider>
      </ToastProvider>
    </I18nProvider>,
  );
}

describe('ProfileForm (integration)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('GET populates fields', async () => {
    const fetchMock = vi.fn(async (input: any, init?: RequestInit) => {
      const url = String(input);
      const path = pathnameOf(url);
      const method = String(init?.method || 'GET').toUpperCase();
      if (path.endsWith('/api/me/profile') && method === 'GET') {
        return jsonResponse({
          data: {
            user: {
              firstname: 'Jane',
              lastname: 'Doe',
              name: 'Jane Doe',
              photo: '/avatar.jpg',
              bio: 'Hello',
              facebook_url: 'https://facebook.com/jane',
            },
          },
        });
      }
      return jsonResponse({message: `Unhandled ${method} ${path}`}, 500);
    });
    vi.stubGlobal('fetch', fetchMock as any);

    renderWithProviders(
      <ProfileForm initialName="Initial User" initialPhoto="/initial.jpg" onClose={() => {}} onUpdatedUser={() => {}} />,
    );

    expect(await screen.findByDisplayValue('Jane Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Hello')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://facebook.com/jane')).toBeInTheDocument();
  });

  it('PUT sends correct payload when PATCH is not allowed', async () => {
    const calls: Array<{path: string; method: string; body?: any}> = [];

    const fetchMock = vi.fn(async (input: any, init?: RequestInit) => {
      const url = String(input);
      const path = pathnameOf(url);
      const method = String(init?.method || 'GET').toUpperCase();
      calls.push({path, method, body: (init as any)?.body});

      if (path.endsWith('/api/me/profile') && method === 'GET') {
        return jsonResponse({data: {user: {name: 'Jane Doe', photo: '/avatar.jpg'}}});
      }

      if (path.endsWith('/api/me/profile') && method === 'PATCH') {
        return jsonResponse({message: 'Method Not Allowed'}, 405);
      }

      if (path.endsWith('/api/me/profile') && method === 'PUT') {
        return jsonResponse({data: {user: {name: 'John Smith', photo: '/avatar.jpg', bio: 'Bio'}}});
      }

      return jsonResponse({message: `Unhandled ${method} ${path}`}, 500);
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const onClose = vi.fn();
    const onUpdatedUser = vi.fn();

    renderWithProviders(<ProfileForm initialName="Initial User" initialPhoto="/initial.jpg" onClose={onClose} onUpdatedUser={onUpdatedUser} />);

    await screen.findByDisplayValue('Jane Doe');
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText('Full name'));
    await user.type(screen.getByLabelText('Full name'), 'John Smith');
    await user.clear(screen.getByLabelText('Bio'));
    await user.type(screen.getByLabelText('Bio'), 'Bio');
    await user.clear(screen.getByLabelText('Facebook URL'));
    await user.type(screen.getByLabelText('Facebook URL'), 'https://facebook.com/john');

    await user.click(screen.getByRole('button', {name: 'Save Changes'}));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onUpdatedUser).toHaveBeenCalledWith(expect.objectContaining({name: 'John Smith'}));

    const putCall = calls.find((c) => c.method === 'PUT' && c.path.endsWith('/api/me/profile'));
    expect(putCall).toBeTruthy();
    const putBody = JSON.parse(String(putCall?.body || '{}'));
    expect(putBody).toEqual(
      expect.objectContaining({
        firstname: 'John',
        lastname: 'Smith',
        name: 'John Smith',
        bio: 'Bio',
        facebook_url: 'https://facebook.com/john',
      }),
    );
  });

  it('POST /me/avatar uploads file and sets preview', async () => {
    const fetchMock = vi.fn(async (input: any, init?: RequestInit) => {
      const url = String(input);
      const path = pathnameOf(url);
      const method = String(init?.method || 'GET').toUpperCase();

      if (path.endsWith('/api/me/profile') && method === 'GET') {
        return jsonResponse({data: {user: {name: 'Jane Doe', photo: '/avatar.jpg'}}});
      }
      if (path.endsWith('/api/me/avatar') && method === 'POST') {
        return jsonResponse({data: {user: {name: 'Jane Doe', photo: '/server/avatar.jpg'}}});
      }

      return jsonResponse({message: `Unhandled ${method} ${path}`}, 500);
    });
    vi.stubGlobal('fetch', fetchMock as any);

    renderWithProviders(
      <ProfileForm initialName="Initial User" initialPhoto="/initial.jpg" onClose={() => {}} onUpdatedUser={() => {}} />,
    );

    await screen.findByDisplayValue('Jane Doe');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();
    const user = userEvent.setup();
    const file = new File(['x'], 'avatar.jpg', {type: 'image/jpeg'});

    await user.upload(fileInput!, file);

    const avatarImg = await screen.findByAltText('Jane Doe avatar');
    await waitFor(() => {
      const src = avatarImg.getAttribute('src') || '';
      expect(src).toContain('/server/avatar.jpg');
    });
  });

  it('maps backend validation errors to field messages', async () => {
    const fetchMock = vi.fn(async (input: any, init?: RequestInit) => {
      const url = String(input);
      const path = pathnameOf(url);
      const method = String(init?.method || 'GET').toUpperCase();

      if (path.endsWith('/api/me/profile') && method === 'GET') {
        return jsonResponse({data: {user: {name: 'Jane Doe', photo: '/avatar.jpg'}}});
      }

      if (path.endsWith('/api/me/profile') && method === 'PATCH') {
        return jsonResponse(
          {
            success: false,
            message: 'Validation error',
            errors: {
              firstname: ['First name is required.'],
              facebook_url: ['Facebook URL must be a valid URL.'],
            },
          },
          422,
        );
      }

      return jsonResponse({message: `Unhandled ${method} ${path}`}, 500);
    });
    vi.stubGlobal('fetch', fetchMock as any);

    renderWithProviders(
      <ProfileForm initialName="Initial User" initialPhoto="/initial.jpg" onClose={() => {}} onUpdatedUser={() => {}} />,
    );

    await screen.findByDisplayValue('Jane Doe');
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', {name: 'Save Changes'}));

    expect(await screen.findByText('First name is required.')).toBeInTheDocument();
    expect(await screen.findByText('Facebook URL must be a valid URL.')).toBeInTheDocument();
  });
});
