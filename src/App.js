import { useState, useEffect } from 'react';
import * as Sentry from "@sentry/react";
import useNdef from './useNdef'
import NewMessageForm from './new-message-form';
import './App.css';
import packageJson from '../package.json';

const { homepage: homepageUrl } = packageJson

function App() {

  const [messageBoard, setMessageBoard] = useState(null);
  const [pendingMessages, setPendingMessages] = useState([]);

  const {
    supported: nfcSupported,
    permissionStatus: nfcPermissionStatus,
    promptNdef,
    latestReadEvent,
    setPendingRecords,
    error: nfcError,
  } = useNdef({ 
    onWriteSuccess: () => {
      const messageBoardId = messageBoard.id
      const messages = messageBoard.messages
      // send diagnostic info
      Sentry.captureMessage(`write ${messageBoardId}`, {
        level: 'info',
        extra: {
          pendingMessages,
          messageBoardId,
          messages,
        }
      });
      // reset write queue
      setPendingMessages([]);
    },
  });

  useEffect(() => {
    if (!latestReadEvent) return
    const messageBoardId = latestReadEvent.serialNumber
    const messages = readMessageBoardMessagesFromRecords(latestReadEvent.message.records)
    setMessageBoard({
      id: messageBoardId,
      messages,
    })
    // send diagnostic info
    Sentry.captureMessage(`read ${messageBoardId}`, {
      level: 'info',
      extra: {
        pendingMessages,
        messageBoardId,
        messages,
      }
    });
  }, [latestReadEvent]);

  function readMessageBoardMessagesFromRecords (records) {
    return records
      .filter(({recordType}) => recordType === 'text')
      .map(decodeTextRecord)
  }

  return (
    <div className="App">
      <div className="outer-container">
        {renderAppContent()}
      </div>
    </div>
  );

  function submitMessage (message) {
    const messageBoardId = messageBoard.id
    const messages = messageBoard.messages
    // command to clear message board
    if (message === 'command clear') {
      setPendingRecords([
        { recordType: 'url', data: homepageUrl },
      ]);
      setPendingMessages([])
      setMessageBoard({
        id: messageBoardId,
        messages: [],
      })
      return
    }
    // normal message submit
    const newPendingMessages = [...pendingMessages, message];
    setPendingMessages(newPendingMessages)
    setPendingRecords([
      // first record is a non-message link to the message board
      { recordType: 'url', data: homepageUrl },
      ...messages.map(text => ({ recordType: 'text', data: text })),
      ...newPendingMessages.map(text => ({ recordType: 'text', data: text })),
    ])
    // send diagnostic info
    Sentry.captureMessage(`prep ${messageBoardId}: "${message}"`, {
      level: 'info',
      extra: {
        newMessage: message,
        pendingMessages,
        messageBoardId,
        messages,
      }
    });
  }

  function startDemo () {
    setMessageBoard({
      id: 'demo board',
      messages: [
        '1 short',
        'very long even longer than that and yet longer still are you still there i have something to describe here i do\nand thats not the half of it',
        `Hello world, Καλημέρα κόσμε, コンニチハ`,
      ],
    })
  }

  function renderAppContent () {
    if (messageBoard) {
      return renderMessageBoard(messageBoard)
    } else {
      return (
        <main className="App-container">
          <div className='setup-instructions'>
            { !nfcSupported && renderNotSupported()}
            { nfcSupported && nfcPermissionStatus === 'prompt' && renderPrompt()}
            { nfcSupported && nfcPermissionStatus === 'granted' && renderPleaseScan()}
            { nfcSupported && nfcPermissionStatus === 'denied' && renderDenied()}
            { nfcSupported && nfcError && nfcError.toString()}
          </div>
        </main>
      )
    }
  }

  function renderMessageBoard (messageBoard) {
    const messageBoardLabel = `Message Board: ${messageBoard.id}`
    return (
      <>
        <header>
          <p>{nfcError ? nfcError.toString() : messageBoardLabel}</p>
        </header>
        <main className="App-container">
          <div className="message-container">
            {messageBoard.messages.map((message, index) => renderMessage(message, index))}
            {pendingMessages.map((message, index) => renderMessage(message, index, true))}
          </div>
          {renderMessageInput()}
        </main>
      </>
    )
  }

  function renderMessage (message, index, pending = false) {
    return (
      <div key={index} className={"message " + (pending ? 'message-pending' : '')}>
        <span className="identicon">🧞</span>
        <pre>{message}</pre>
      </div>
    )
  }

  function renderMessageInput () {
    return (
      <div className='message-input'>
        <NewMessageForm onSubmit={submitMessage}/>
      </div>
    )
  }

  function renderNotSupported () {
    return (
      <>
        <p>NFC not supported</p>
        <button onClick={startDemo}>try demo</button>
        <button onClick={() => {throw new Error("Error.");}}>Error button</button>
      </>
    )
  }

  function renderPrompt () {
    return (
      <>
        <p>Please allow NFC access in order to read Message Board</p>
        <button onClick={promptNdef}>
          click here
        </button>
      </>
    )
  }

}

function renderPleaseScan () {
  return (
    <>
      <p>Please scan a Message Board</p>
    </>
  )
}

function renderDenied () {
  return (
    <>
      <p>You have denied NFC permissions, they are required. Please reset NFC permissions.</p>
    </>
  )
}

function decodeTextRecord (record) {
  const textDecoder = new TextDecoder(record.encoding);
  return textDecoder.decode(record.data);
}

export default App;
