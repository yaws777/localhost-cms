import React, { createContext, useContext, useState, useEffect } from 'react';

const MultiAccountContext = createContext(null);

// Helper function to resolve a consistent unique user ID regardless of role schema
const getUserId = (user) => {
  if (!user) return null;
  return String(user.id || user.user_id || user.parent_id || user.student_id || user.username);
};

export const MultiAccountProvider = ({ children }) => {
  // 1. Initialize global sessions registry from localStorage
  const [sessions, setSessions] = useState(() => {
    try {
      const saved = localStorage.getItem('app_multi_sessions');
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.error('Failed to load multi-sessions from localStorage:', error);
      return {};
    }
  });

  // 2. Initialize tab-isolated active user ID pointer from sessionStorage (falling back to localStorage)
  const [activeUserId, setActiveUserId] = useState(() => {
    return sessionStorage.getItem('app_active_user_id') || localStorage.getItem('app_active_user_id') || null;
  });

  // 3. Keep global sessions registry synchronized with localStorage
  useEffect(() => {
    localStorage.setItem('app_multi_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // 4. Synchronize active tab user context into sessionStorage for tab isolation
  useEffect(() => {
    if (activeUserId && sessions[activeUserId]) {
      sessionStorage.setItem('app_active_user_id', activeUserId);
      
      const currentSession = sessions[activeUserId];
      // Store user data in sessionStorage so this tab never collides with other tabs
      sessionStorage.setItem('user', JSON.stringify(currentSession.user));

      if (currentSession.user.parent_id) {
        sessionStorage.setItem('parent_id', currentSession.user.parent_id);
      }
    } else {
      sessionStorage.removeItem('app_active_user_id');
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('parent_id');
    }
  }, [activeUserId, sessions]);

  /**
   * Add a new account after login or update an existing session.
   * @param {Object} user - User profile object from API
   * @param {String|null} token - Optional JWT/Auth token
   */
  const addSession = (user, token = null) => {
    const userId = getUserId(user);
    if (!userId) {
      console.error('addSession failed: User object missing valid identifier (id, user_id, parent_id, etc.)');
      return;
    }

    setSessions((prevSessions) => ({
      ...prevSessions,
      [userId]: {
        user,
        token,
        lastActive: new Date().toISOString()
      }
    }));

    // Set as active user for this tab
    setActiveUserId(userId);
  };

  /**
   * Switch active account for the current tab
   * @param {String|Number} targetUserId
   */
  const switchAccount = (targetUserId) => {
    const idString = String(targetUserId);
    if (sessions[idString]) {
      setActiveUserId(idString);
    } else {
      console.warn(`Account with ID ${targetUserId} not found in stored sessions.`);
    }
  };

  /**
   * Remove a single account session (Log out one account)
   * @param {String|Number} targetUserId
   */
  const removeAccount = (targetUserId) => {
    const idString = String(targetUserId);

    setSessions((prevSessions) => {
      const updated = { ...prevSessions };
      delete updated[idString];
      return updated;
    });

    if (activeUserId === idString) {
      const remainingUserIds = Object.keys(sessions).filter((id) => id !== idString);
      if (remainingUserIds.length > 0) {
        setActiveUserId(remainingUserIds[0]);
      } else {
        setActiveUserId(null);
      }
    }
  };

  /**
   * Log out all accounts and clear storage
   */
  const logoutAll = () => {
    setSessions({});
    setActiveUserId(null);
    sessionStorage.clear();
    localStorage.removeItem('app_multi_sessions');
    localStorage.removeItem('app_active_user_id');
    localStorage.removeItem('user');
    localStorage.removeItem('parent_id');
    localStorage.removeItem('linkedStudents');
    localStorage.removeItem('selectedStudentId');
  };

  // Derive current active session
  const activeSession = activeUserId ? sessions[activeUserId] || null : null;

  return (
    <MultiAccountContext.Provider
      value={{
        sessions: Object.values(sessions), // List of all stored sessions [{ user, token, lastActive }]
        activeSession,                     // Currently active session { user, token, lastActive }
        activeUserId,                      // Current active user ID
        addSession,                        // Register account on login
        switchAccount,                     // Switch active user
        removeAccount,                     // Log out individual user
        logoutAll,                         // Log out all accounts
      }}
    >
      {children}
    </MultiAccountContext.Provider>
  );
};

export const useMultiAccount = () => {
  const context = useContext(MultiAccountContext);
  if (!context) {
    throw new Error('useMultiAccount must be used within a <MultiAccountProvider>');
  }
  return context;
};