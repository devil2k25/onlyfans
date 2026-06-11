import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { createCallSession } from '../api/calls';
import IncomingCallNotification from './IncomingCallNotification';
import CallModal from './CallModal';

const CallManagerContext = createContext(null);
export const useCallManager = () => useContext(CallManagerContext);

export default function CallManager({ children }) {
  const { socket } = useSocket();
  const { user } = useAuth();

  const [incomingCall, setIncomingCall] = useState(null); // { session, caller, callType }
  const [activeCall, setActiveCall] = useState(null);     // { session, targetUser, callType, isIncoming }

  // Listen for incoming calls
  useEffect(() => {
    if (!socket) return;

    const handleIncoming = ({ session, caller, callType }) => {
      setIncomingCall({ session, caller, callType });
    };

    const handleCallRejected = () => {
      setActiveCall(null);
    };

    socket.on('call:incoming', handleIncoming);
    socket.on('call:rejected', handleCallRejected);

    return () => {
      socket.off('call:incoming', handleIncoming);
      socket.off('call:rejected', handleCallRejected);
    };
  }, [socket]);

  const handleAcceptIncoming = useCallback(() => {
    if (!incomingCall) return;
    setActiveCall({
      session: incomingCall.session,
      targetUser: incomingCall.caller,
      callType: incomingCall.callType,
      isIncoming: true,
    });
    setIncomingCall(null);
  }, [incomingCall]);

  const handleRejectIncoming = useCallback(() => {
    if (!incomingCall) return;
    socket?.emit('call:reject', {
      sessionId: incomingCall.session?.id,
      targetUserId: incomingCall.caller?.id,
    });
    setIncomingCall(null);
  }, [incomingCall, socket]);

  const handleCallEnd = useCallback(() => {
    setActiveCall(null);
  }, []);

  // Initiate an outgoing call
  const initiateCall = useCallback(
    async (targetUser, callType) => {
      if (!user || !targetUser) return;
      try {
        const res = await createCallSession(targetUser.id, callType);
        const session = res.data?.data || res.data;
        setActiveCall({ session, targetUser, callType, isIncoming: false });
      } catch (err) {
        console.error('Failed to initiate call:', err);
      }
    },
    [user]
  );

  return (
    <CallManagerContext.Provider value={{ initiateCall }}>
      {children}

      {/* Incoming call notification */}
      {incomingCall && !activeCall && (
        <IncomingCallNotification
          session={incomingCall.session}
          caller={incomingCall.caller}
          callType={incomingCall.callType}
          onAccept={handleAcceptIncoming}
          onReject={handleRejectIncoming}
        />
      )}

      {/* Active call modal */}
      {activeCall && (
        <CallModal
          session={activeCall.session}
          targetUser={activeCall.targetUser}
          callType={activeCall.callType}
          isIncoming={activeCall.isIncoming}
          onEnd={handleCallEnd}
        />
      )}
    </CallManagerContext.Provider>
  );
}
