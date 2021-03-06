﻿var WorkSiteBrowser = function () {
    var _activeX;

    var _init = function () {
        if ("undefined" !== typeof (window.ActiveXObject)) {
            _activeX = new ActiveXObject('PhoenixBs.SharepointUtils.Worksite');
        }
    }

    var _select = function () {
        if (null != _activeX) {
            return _activeX.GetDocument();
        }
        return null;
    }

    var _selectMultiple = function () {
        if (null != _activeX) {
            var query =
                '<document>' +
                '  <property name="imProfileDocNum"></property>' +
                '  <property name="imProfileVersion"></property>' +
                '  <property name="imProfileType"></property>' +
                '  <property name="imProfileDescription"></property>' +
                '</document>';
            var docs = _activeX.GetDocuments(query);
            var docsXml = new ActiveXObject("Microsoft.XMLDOM");
            docsXml.async = false;
            docsXml.loadXML("<documents>" + docs + "</documents>");
            var documents = new Array();

            $(docsXml).find("document").each(function (i, e) {
                var docObjectId = $(e).attr("objectid");
                var docNum = $(e).find("property[name='imProfileDocNum']").attr("value");
                var docVersion = $(e).find("property[name='imProfileVersion']").attr("value");
                var docName = $(e).attr("name");
                var docType = $(e).find("property[name='imProfileType']").attr("value");
                var docDescription = $(e).find("property[name='imProfileDescription']").attr("value");

                documents.push({ ObjectID: docObjectId, DocNum: docNum, Version: docVersion, Name: docName, Type: docType, Description: docDescription });
            });

            return documents;
        }
        return null;
    }

    var _selectFolders = function () {
        if (null != _activeX) {
            var monikers = _activeX.GetFolders();
            if (monikers) {
                return monikers.split("***");
            }
            return null;
        }
        // test data
        else {
            return [
                "!nrtdms:0:!session:LONDMS01:!database:WORKSITE:!page:4628:",
                "!nrtdms:0:!session:LONDMS01:!database:WORKSITE:!page:562:",
                "!nrtdms:0:!session:LONDMS01:!database:WORKSITE:!page:1535:",
                "!nrtdms:0:!session:LONDMS01:!database:WORKSITE:!page:5541:"
            ];
        }
    }

    return {
        Init: function () {
            _init();
        },

        Select: function () {
            return _select();
        },

        SelectMultiple: function () {
            return _selectMultiple();
        },

        SelectFolders: function () {
            return _selectFolders();
        }
    }
}();