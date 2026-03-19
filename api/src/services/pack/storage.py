"""S3 storage for pack zip files."""

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError


class PackStorageError(Exception):
    """Raised when pack storage operations fail."""

    pass


class PackStorage:
    """Handles S3 storage for generated pack zip files."""

    def __init__(
        self,
        bucket_name: str | None = None,
        region: str | None = None,
        url_expiration_hours: int = 24,
    ) -> None:
        """Initialize pack storage.

        Args:
            bucket_name: S3 bucket name. Defaults to PACK_STORAGE_BUCKET env var.
            region: AWS region. Defaults to AWS_REGION env var.
            url_expiration_hours: Hours until signed URL expires.
        """
        self.bucket_name = bucket_name or os.getenv("PACK_STORAGE_BUCKET", "enkai-qualify-packs")
        self.region = region or os.getenv("AWS_REGION", "us-east-1")
        self.url_expiration_hours = url_expiration_hours

        config = Config(
            region_name=self.region,
            signature_version="s3v4",
            retries={"max_attempts": 3, "mode": "standard"},
        )

        self.s3_client = boto3.client("s3", config=config)

    def upload_pack(
        self,
        zip_path: str | Path,
        pack_id: str | None = None,
        metadata: dict[str, str] | None = None,
    ) -> tuple[str, datetime]:
        """Upload a pack zip file to S3.

        Args:
            zip_path: Local path to the zip file.
            pack_id: Optional pack ID for the S3 key. Auto-generated if not provided.
            metadata: Optional metadata to attach to the S3 object.

        Returns:
            Tuple of (signed_url, expiration_datetime).

        Raises:
            PackStorageError: If upload fails.
            FileNotFoundError: If zip file doesn't exist.
        """
        zip_path = Path(zip_path)

        if not zip_path.exists():
            raise FileNotFoundError(f"Zip file not found: {zip_path}")

        if not zip_path.suffix == ".zip":
            raise PackStorageError(f"File must be a zip file: {zip_path}")

        # Generate S3 key
        if pack_id is None:
            pack_id = zip_path.stem

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        s3_key = f"packs/{pack_id}/{timestamp}.zip"

        # Prepare metadata
        s3_metadata = {
            "pack-id": pack_id,
            "uploaded-at": datetime.now(timezone.utc).isoformat(),
        }
        if metadata:
            s3_metadata.update(metadata)

        try:
            # Upload file
            self.s3_client.upload_file(
                str(zip_path),
                self.bucket_name,
                s3_key,
                ExtraArgs={
                    "ContentType": "application/zip",
                    "Metadata": s3_metadata,
                },
            )

            # Generate signed URL
            signed_url = self._generate_signed_url(s3_key)
            expiration = datetime.now(timezone.utc) + timedelta(
                hours=self.url_expiration_hours
            )

            return signed_url, expiration

        except ClientError as e:
            raise PackStorageError(f"Failed to upload pack: {e}") from e

    def _generate_signed_url(self, s3_key: str) -> str:
        """Generate a pre-signed download URL.

        Args:
            s3_key: S3 object key.

        Returns:
            Pre-signed URL string.
        """
        url = self.s3_client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": self.bucket_name,
                "Key": s3_key,
            },
            ExpiresIn=self.url_expiration_hours * 3600,
        )
        return url

    def get_pack_url(self, pack_id: str) -> tuple[str, datetime] | None:
        """Get the latest download URL for a pack.

        Args:
            pack_id: Pack identifier.

        Returns:
            Tuple of (signed_url, expiration) or None if not found.
        """
        try:
            # List objects with pack prefix
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=f"packs/{pack_id}/",
            )

            if "Contents" not in response or not response["Contents"]:
                return None

            # Get the latest object
            latest = max(response["Contents"], key=lambda x: x["LastModified"])
            s3_key = latest["Key"]

            signed_url = self._generate_signed_url(s3_key)
            expiration = datetime.now(timezone.utc) + timedelta(
                hours=self.url_expiration_hours
            )

            return signed_url, expiration

        except ClientError:
            return None

    def delete_pack(self, pack_id: str) -> bool:
        """Delete all versions of a pack.

        Args:
            pack_id: Pack identifier.

        Returns:
            True if deletion succeeded.
        """
        try:
            # List all objects for this pack
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=f"packs/{pack_id}/",
            )

            if "Contents" not in response:
                return True

            # Delete all objects
            objects = [{"Key": obj["Key"]} for obj in response["Contents"]]
            self.s3_client.delete_objects(
                Bucket=self.bucket_name,
                Delete={"Objects": objects},
            )

            return True

        except ClientError:
            return False

    def list_packs(self, limit: int = 100) -> list[dict[str, Any]]:
        """List available packs.

        Args:
            limit: Maximum number of packs to return.

        Returns:
            List of pack info dictionaries.
        """
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix="packs/",
                Delimiter="/",
            )

            packs = []
            for prefix in response.get("CommonPrefixes", [])[:limit]:
                parts = prefix["Prefix"].split("/")
                if len(parts) < 2 or not parts[1]:
                    continue
                pack_id = parts[1]
                packs.append({"pack_id": pack_id})

            return packs

        except ClientError:
            return []
