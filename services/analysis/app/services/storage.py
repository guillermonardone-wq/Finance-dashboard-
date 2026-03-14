"""S3-compatible object storage client for the Python analysis service."""

import io
import json
import boto3
from app.config import settings


def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region,
    )


def download_json(key: str, bucket: str | None = None) -> dict:
    """Download and parse a JSON file from object storage."""
    s3 = get_s3_client()
    bucket = bucket or settings.s3_bucket_uploads
    response = s3.get_object(Bucket=bucket, Key=key)
    return json.loads(response["Body"].read().decode("utf-8"))


def upload_file(
    key: str,
    data: bytes,
    content_type: str = "application/octet-stream",
    bucket: str | None = None,
) -> str:
    """Upload a file to object storage. Returns the key."""
    s3 = get_s3_client()
    bucket = bucket or settings.s3_bucket_generated
    s3.put_object(Bucket=bucket, Key=key, Body=data, ContentType=content_type)
    return key


def upload_json(key: str, data: dict, bucket: str | None = None) -> str:
    """Upload a JSON object to object storage."""
    return upload_file(
        key,
        json.dumps(data, indent=2).encode("utf-8"),
        "application/json",
        bucket,
    )
