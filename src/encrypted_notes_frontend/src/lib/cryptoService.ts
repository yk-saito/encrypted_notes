import { ActorSubclass } from '@dfinity/agent';
import { v4 as uuidV4 } from 'uuid';

import {
  _SERVICE,
  RegisterKeyResult,
} from '../../../declarations/encrypted_notes_backend/encrypted_notes_backend.did';
import { loadKey, storeKey } from './keyStorage';

export class CryptoService {
  private actor: ActorSubclass<_SERVICE>;
  private publicKey: CryptoKey | null;
  private privateKey: CryptoKey | null;
  private symmetricKey: CryptoKey | null;
  public readonly deviceAlias: string;

  /** STEP1: コンストラクタを定義する */
  constructor(actor: ActorSubclass<_SERVICE>) {
    this.actor = actor;

    this.deviceAlias = window.localStorage.getItem('deviceAlias');
    if (!this.deviceAlias) {
      this.deviceAlias = uuidV4();
      window.localStorage.setItem('deviceAlias', this.deviceAlias);
    }
    console.log(`Device alias: ${this.deviceAlias}`); // TODO: delete
  }

  /**
   * 鍵に関する設定を行う初期化関数です。
   */
  // TODO: 鍵の生成・同期処理を実装する際に、戻り値を`bool`にする
  public async init(): Promise<void> {
    /** STEP4: 公開鍵・秘密鍵の取得と保存 */
    // データベースから公開鍵・秘密鍵を取得します。
    this.publicKey = await loadKey('publicKey');
    this.privateKey = await loadKey('privateKey');

    if (!this.publicKey || !this.privateKey) {
      // 公開鍵・秘密鍵が存在しない場合は、生成します。
      const keyPair: CryptoKeyPair = await this.generateKeyPair();

      // 生成した鍵をデータベースに保存します。
      await storeKey('publicKey', keyPair.publicKey);
      await storeKey('privateKey', keyPair.privateKey);

      this.publicKey = keyPair.publicKey;
      this.privateKey = keyPair.privateKey;
    }

    // publicKeyをexportしてBase64に変換します。
    const exportedPublicKey = await window.crypto.subtle.exportKey(
      'spki',
      this.publicKey,
    );
    const exportedPublicKeyBase64 = this.arrayBufferToBase64(exportedPublicKey);

    /** STEP2: デバイスデータの登録*/
    // バックエンドキャニスターにデバイスエイリアスと（"STEP4"が完了したら）公開鍵を登録します。
    await this.actor.registerDevice(this.deviceAlias, exportedPublicKeyBase64);

    /** STEP5: 対称鍵を取得する */
    const isSymKeyRegistered =
      await this.actor.isEncryptedSymmetricKeyRegistered();
    if (!isSymKeyRegistered) {
      console.log('Generate symmetric key...');
      // 対称鍵を生成します。
      this.symmetricKey = await this.generateSymmetricKey();
      // 対称鍵を公開鍵で暗号化します。
      const wrappedSymmetricKey: ArrayBuffer = await this.wrapSymmetricKey(
        this.symmetricKey,
        this.publicKey,
      );
      const wrappedSymmetricKeyBase64: string =
        this.arrayBufferToBase64(wrappedSymmetricKey);
      // 暗号化した対称鍵をバックエンドキャニスターに登録します。
      const result: RegisterKeyResult =
        await this.actor.registerEncryptedSymmetricKey(
          exportedPublicKeyBase64,
          wrappedSymmetricKeyBase64,
        );
      if ('Err' in result) {
        if ('UnknownPublicKey' in result.Err) {
          throw new Error('Unknown public key');
        }
        if ('AlreadyRegistered' in result.Err) {
          throw new Error('Already registered');
        }
        if ('DeviceNotRegistered' in result.Err) {
          throw new Error('Device not registered');
        }
      }
      console.log('Synchronizing symmetric keys...');
    } else {
      console.log('Get symmetric key...');
      // TODO: 対称鍵の取得処理を実装する
    }
  }

  /** STEP3: デバイスデータの削除 */
  public async clearDeviceData(): Promise<void> {
    window.localStorage.removeItem('deviceAlias');
    // TODO: データベース内の鍵の削除を実装する
  }

  // TODO: 以下の関数はスターターに入れておく
  private async generateKeyPair(): Promise<CryptoKeyPair> {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        // キー長
        modulusLength: 4096,
        // 公開指数（65537 == 0x010001）
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
        // ハッシュアルゴリズム
        hash: 'SHA-256',
      },
      true,
      ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'],
    );
    return keyPair;
  }

  private async generateSymmetricKey(): Promise<CryptoKey> {
    const symmetricKey = await window.crypto.subtle.generateKey(
      {
        // キー生成のアルゴリズム
        name: 'AES-GCM',
        // キー長
        length: 256,
      },
      // キーを抽出可能（バイト配列としてエクスポートできること）とする
      true,
      // キーがサポートする使用法
      ['encrypt', 'decrypt'],
    );
    return symmetricKey;
  }

  private async wrapSymmetricKey(
    symmetricKey: CryptoKey,
    wrappingKey: CryptoKey,
  ): Promise<ArrayBuffer> {
    const wrappedSymmetricKey = await window.crypto.subtle.wrapKey(
      'raw',
      symmetricKey,
      wrappingKey,
      {
        name: 'RSA-OAEP',
      },
    );
    return wrappedSymmetricKey;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    // 1. new Uint8Array(buffer)で`buffer`の中身を一要素1バイトの配列に変換します。
    // 2. String.fromCharCode()で文字列に変換します。
    // // 文字コード（Uint8Arrayには文字が数値として格納されている）を文字（string型）として扱うためです。
    const stringData = String.fromCharCode(...new Uint8Array(buffer));
    console.log(`stringData: ${stringData}`); // TODO: delete
    // Base64エンコードを行います。
    return window.btoa(stringData);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    // Base64エンコーディングでエンコードされたデータの文字列をデコードします。
    const stringData = window.atob(base64);
    // 1. 一文字ずつ`charCodeAt()`で文字コードに変換します。
    // 2. `Uint8Array.from()`で配列に変換します。
    return Uint8Array.from(stringData, (dataChar) => dataChar.charCodeAt(0));
  }
}
