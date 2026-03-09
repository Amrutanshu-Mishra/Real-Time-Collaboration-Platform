'use client'

import { useState, useCallback } from 'react'

export interface UserInfo {
     userId: string
     name: string
     color: string
}

export interface PresenceState {
     currentUser: UserInfo | null
     onlineUsers: UserInfo[]
}

/**
 * Hook to manage user presence state.
 * Returns the state and a message handler to be called with incoming WS messages.
 */
export function usePresence() {
     const [currentUser, setCurrentUser] = useState<UserInfo | null>(null)
     const [onlineUsers, setOnlineUsers] = useState<UserInfo[]>([])

     /**
      * Call this with incoming WebSocket text messages (JSON).
      * Returns true if the message was a presence message, false otherwise.
      */
     const handlePresenceMessage = useCallback((data: string): boolean => {
          try {
               const msg = JSON.parse(data)

               if (msg.type === 'user-info') {
                    setCurrentUser(msg.user)
                    return true
               }

               if (msg.type === 'presence-update') {
                    setOnlineUsers(msg.users)
                    return true
               }
          } catch {
               // Not JSON — ignore
          }
          return false
     }, [])

     return { currentUser, onlineUsers, handlePresenceMessage }
}
