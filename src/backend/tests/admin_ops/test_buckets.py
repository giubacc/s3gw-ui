# Copyright 2023 SUSE LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from typing import Any, Dict, List

import httpx
import pytest
from pytest_httpx import HTTPXMock

from backend.admin_ops.buckets import list
from backend.admin_ops.types import AdminOpsError, Bucket

bucket_list_response: List[Dict[str, Any]] = [
    {
        "bucket": "foo",
        "num_shards": 1,
        "tenant": "",
        "zonegroup": "",
        "placement_rule": "default",
        "explicit_placement": {
            "data_pool": "",
            "data_extra_pool": "",
            "index_pool": "",
        },
        "id": "foo.1681284188914692706",
        "marker": "foo.1681284188914692706",
        "index_type": "Normal",
        "owner": "testid",
        "ver": "",
        "master_ver": "",
        "mtime": "0.000000",
        "creation_time": "2023-04-12T07:23:08.914692Z",
        "max_marker": "",
        "usage": {},
        "bucket_quota": {
            "enabled": False,
            "check_on_raw": False,
            "max_size": -1,
            "max_size_kb": 0,
            "max_objects": -1,
        },
    },
    {
        "bucket": "bar",
        "num_shards": 1,
        "tenant": "",
        "zonegroup": "",
        "placement_rule": "default",
        "explicit_placement": {
            "data_pool": "",
            "data_extra_pool": "",
            "index_pool": "",
        },
        "id": "bar.168128418863559658",
        "marker": "bar.168128418863559658",
        "index_type": "Normal",
        "owner": "testid",
        "ver": "",
        "master_ver": "",
        "mtime": "0.000000",
        "creation_time": "2023-04-12T07:23:08.063559Z",
        "max_marker": "",
        "usage": {},
        "bucket_quota": {
            "enabled": False,
            "check_on_raw": False,
            "max_size": -1,
            "max_size_kb": 0,
            "max_objects": -1,
        },
    },
]


@pytest.mark.anyio
async def test_bucket_list(httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(  # pyright: ignore [reportUnknownMemberType]
        json=bucket_list_response,
    )

    res: List[Bucket] = await list(
        url="http://foo.bar:123",
        access_key="asd",
        secret_key="qwe",
        uid=None,
    )

    assert len(res) == 2
    assert res[0].bucket == "foo"
    assert res[1].bucket == "bar"


@pytest.mark.anyio
async def test_bucket_list_failure(httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(  # pyright: ignore [reportUnknownMemberType]
        status_code=404  # any error, really
    )

    raised = False
    try:
        await list(
            url="http://foo.bar:123",
            access_key="asd",
            secret_key="qwe",
            uid=None,
        )
    except AdminOpsError:
        raised = True

    assert raised


@pytest.mark.anyio
async def test_bucket_list_with_uid(httpx_mock: HTTPXMock) -> None:
    called_cb = False

    def check_uid(req: httpx.Request) -> httpx.Response:
        nonlocal called_cb
        called_cb = True
        assert str(req.url.query).find("uid=asdasd") >= 0
        return httpx.Response(status_code=200, json=bucket_list_response)

    httpx_mock.add_callback(  # pyright: ignore [reportUnknownMemberType]
        check_uid
    )

    res: List[Bucket] = await list(
        url="http://foo.bar:123",
        access_key="asd",
        secret_key="qwe",
        uid="asdasd",
    )

    assert len(res) == 2
    assert res[0].bucket == "foo"
    assert res[1].bucket == "bar"

    assert called_cb
