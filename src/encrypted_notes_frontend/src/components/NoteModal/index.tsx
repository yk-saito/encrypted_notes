import {
  Button,
  FormControl,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Textarea,
} from '@chakra-ui/react';
import { FC } from 'react';

import type { EncryptedNote } from '../../../../declarations/encrypted_notes_backend/encrypted_notes_backend.did';

interface NoteModalProps {
  currentNote: EncryptedNote;
  isOpen: boolean;
  title: string;
  handleSaveNote: () => void;
  onClose: () => void;
  setCurrentNote: (note: EncryptedNote) => void;
}

export const NoteModal: FC<NoteModalProps> = ({
  currentNote,
  isOpen,
  title,
  handleSaveNote,
  onClose,
  setCurrentNote,
}) => {
  const safeCurrentNote = currentNote || { id: BigInt(0), encrypted_text: '' };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size={'xl'}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl>
            <Textarea
              placeholder="Write your note here..."
              value={safeCurrentNote.encrypted_text}
              onChange={(e) =>
                setCurrentNote({
                  id: safeCurrentNote.id,
                  encrypted_text: e.target.value,
                })
              }
            />
          </FormControl>
        </ModalBody>

        <ModalFooter>
          <Button colorScheme={'blue'} mr={3} onClick={handleSaveNote}>
            Save
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
