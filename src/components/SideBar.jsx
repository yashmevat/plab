// components/Sidebar.jsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  Menu, 
  X, 
  LogOut, 
  User,
  CheckCircle
} from 'lucide-react';
// Role constants
const ROLES = {
  SUPERADMIN: 1,
  AUTHOR: 2,
  USER: 3
};

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setIsOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close sidebar when clicking outside (mobile only)
  useEffect(() => {
    if (!isMobile) return;

    const handleClickOutside = (e) => {
      if (isOpen && !e.target.closest('.sidebar-container') && !e.target.closest('.hamburger-btn')) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isMobile]);

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isMobile && isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, isMobile]);

  if (!user) return null;

  const superadminLinks = [
    { href: '/dashboard/authors', label: '👤 Authors', icon: '👤' },
    // { href: '/dashboard/create-book', label: '📚 Create Book', icon: '📚' },
    // { href: '/dashboard/topics', label: '📝 Topics', icon: '📝' },
    // { href: '/dashboard/mappings', label: '🔗 Mappings', icon: '🔗' }
  ];

  const authorLinks = [
    { href: '/author/books', label: '📖 My Books', icon: '📖' }
  ];

  // Use role_id instead of role
  const links = user.role_id === ROLES.SUPERADMIN ? superadminLinks : authorLinks;

  const closeSidebar = () => {
    if (isMobile) setIsOpen(false);
  };

  // Get panel title based on role_id
  const getPanelTitle = () => {
    switch(user.role_id) {
      case ROLES.SUPERADMIN:
        return 'Admin Panel';
      case ROLES.AUTHOR:
        return 'Author Panel';
      case ROLES.USER:
        return 'User Panel';
      default:
        return 'Dashboard';
    }
  };

  return (
    <>
  {/* Hamburger Button (Mobile Only) */}
  {isMobile && (
    <button
      onClick={() => setIsOpen(!isOpen)}
      className="fixed top-4 left-4 z-50 p-2.5 bg-white border-2 border-gray-200 rounded-lg shadow-lg hover:bg-gray-50 hover:border-gray-300 transition lg:hidden"
      aria-label="Toggle Menu"
    >
      {isOpen ? (
        <X className="w-5 h-5 text-gray-700" />
      ) : (
        <Menu className="w-5 h-5 text-gray-700" />
      )}
    </button>
  )}

  {/* Backdrop Overlay (Mobile Only) */}
  {isMobile && isOpen && (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden transition-opacity"
      onClick={() => setIsOpen(false)}
    />
  )}

  {/* Sidebar */}
  <aside
    className={`
      sidebar-container
      fixed lg:static
      top-0 left-0
      w-64 h-screen
      bg-white border-r border-gray-200
      p-4 flex flex-col
      shadow-xl lg:shadow-none
      z-40
      transition-transform duration-300 ease-in-out
      ${isMobile ? (isOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'}
      lg:translate-x-0
    `}
  >
    {/* Header */}
    <div className="mb-6 pt-12 lg:pt-0 pb-4 border-b border-gray-200">
      <h2 className="text-xl font-bold text-gray-900 mb-1">
        {getPanelTitle()}
      </h2>
      <p className="text-sm text-gray-600">
        Welcome, <span className="text-blue-600 font-semibold">{user.username}</span>
      </p>
    </div>

    {/* Navigation */}
    <nav className="flex-1 overflow-y-auto">
      <ul className="space-y-1">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              onClick={closeSidebar}
              className={`
                flex items-center gap-3
                px-3 py-2.5 rounded-lg
                transition-all duration-200
                group
                ${
                  pathname === link.href
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
            >
              <span className={`
                ${pathname === link.href ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}
              `}>
                {link.icon}
              </span>
              <span className="flex-1">{link.label.split(' ').slice(1).join(' ')}</span>
              {pathname === link.href && (
                <CheckCircle className="w-4 h-4 text-blue-600" />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>

    {/* Divider */}
    <div className="my-4 border-t border-gray-200"></div>

    {/* User Info Card */}
    <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-200">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          <User className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate text-sm">{user.username}</p>
          <p className="text-xs text-gray-500 capitalize">
            {user.role_name || 'User'}
          </p>
        </div>
      </div>
    </div>

    {/* Logout Button */}
    <button
      onClick={() => {
        logout();
        closeSidebar();
      }}
      className="
        w-full px-4 py-2.5
        bg-red-50 hover:bg-red-100
        text-red-600 hover:text-red-700
        border border-red-200
        rounded-lg transition-all duration-200
        flex items-center justify-center gap-2
        font-medium text-sm
      "
    >
      <LogOut className="w-4 h-4" />
      <span>Logout</span>
    </button>
  </aside>
</>
  );
}
