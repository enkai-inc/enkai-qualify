import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { Sidebar } from '../Sidebar';

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  );
});

// Mock next/navigation
let mockPathname = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

function setPathname(path: string) {
  mockPathname = path;
}

const activeClass = 'bg-gray-800 text-white';
const inactiveClass = 'text-gray-400';

function getNavLink(name: string) {
  return screen.getByText(name).closest('a');
}

describe('Sidebar', () => {
  describe('active state logic', () => {
    it('highlights Ideas when pathname is /ideas', () => {
      setPathname('/ideas');
      render(<Sidebar user={null} />);
      const ideasLink = getNavLink('Ideas');
      expect(ideasLink?.className).toContain(activeClass);
    });

    it('highlights Ideas when pathname starts with /ideas/', () => {
      setPathname('/ideas/some-idea-id');
      render(<Sidebar user={null} />);
      const ideasLink = getNavLink('Ideas');
      expect(ideasLink?.className).toContain(activeClass);
    });

    it('highlights Ideas when pathname is /workspace/some-id', () => {
      setPathname('/workspace/some-idea-id');
      render(<Sidebar user={null} />);
      const ideasLink = getNavLink('Ideas');
      expect(ideasLink?.className).toContain(activeClass);
    });

    it('highlights Ideas when pathname starts with /workspace', () => {
      setPathname('/workspace');
      render(<Sidebar user={null} />);
      const ideasLink = getNavLink('Ideas');
      expect(ideasLink?.className).toContain(activeClass);
    });

    it('does not highlight Ideas when on /billing', () => {
      setPathname('/billing');
      render(<Sidebar user={null} />);
      const ideasLink = getNavLink('Ideas');
      expect(ideasLink?.className).toContain(inactiveClass);
    });

    it('highlights Billing when pathname is /billing', () => {
      setPathname('/billing');
      render(<Sidebar user={null} />);
      const billingLink = getNavLink('Billing');
      expect(billingLink?.className).toContain(activeClass);
    });

    it('highlights Home when pathname is /', () => {
      setPathname('/');
      render(<Sidebar user={null} />);
      const homeLink = getNavLink('Home');
      expect(homeLink?.className).toContain(activeClass);
    });

    it('does not highlight Home when on /ideas', () => {
      setPathname('/ideas');
      render(<Sidebar user={null} />);
      const homeLink = getNavLink('Home');
      expect(homeLink?.className).toContain(inactiveClass);
    });
  });
});
