$(document).ready(function () {
    fetchAllInstances()
        .then(setInstanceSelections)
        .then(handleInitialCLIAuth)
        .then(handleCollectionsRequests);
    //TODO then select/fetch current instance from url param for the dropdown

    $("#instance-accordion li").on("click", e => {
        // prevent carbon from doing its normal thing with the accordion
        e.stopPropagation();

        let newName = handleInstanceSelection(e.target);
        fetchAnInstance(newName)
            .then(updateInstanceView);
    });

    $("#sync-collections-icon").on("click", (e) => {
        if (e.target.getAttribute("class") == "icon-active") {
            let instanceName = $("#instance-accordion").find(".bx--accordion__title").text();
            $(".table-loader").show();
            $("#collection-table").hide();
            $("#collection-table-body").empty();
            $("#cli-version").empty();
            syncColletions(instanceName);
        }
    });

    $("#collection-table-body").on("click", ".deactivate-collection-icon", (e) => {
        let collectionName = e.currentTarget.getAttribute("collection-name");
        $("#modal-collection-name").text(collectionName);
    });

    $("#modal-confirm-deactivation").on("click", () => {
        let collectionName = $("#modal-collection-name").text();
        $(".table-loader").show();
        $("#collection-table").hide();
        $("#collection-table-body").empty();
        $("#cli-version").empty();
        deactivateCollection(collectionName);
    });

});

function handleCollectionsRequests(instanceName) {
    getCollectionData(instanceName);
    getCliVersion(instanceName);
}

function getCollectionData(instanceName) {
    if (typeof instanceName === "undefined") {
        return;
    }
    return fetch(`/api/auth/kabanero/${instanceName}/collections/list`)
        .then(function (response) {
            return response.json();
        })
        .then(updateCollectionView)
        .catch(error => console.error("Error getting collections", error));
}

function getCliVersion(instanceName) {
    if (typeof instanceName === "undefined") {
        return;
    }
    return fetch(`/api/auth/kabanero/${instanceName}/collections/version`)
        .then(function (response) {
            return response.json()
        })
        .then(setCLIVersion)
        .catch(error => console.error("Error getting CLI Version", error));
}

function deactivateCollection(collectionName) {
    let instanceName = $("#instance-accordion").find(".bx--accordion__title").text();

    return fetch(`/api/auth/kabanero/${instanceName}/collections/deactivate/${collectionName}`)
        .then(function (response) {
            return response.json()
        })
        .then(handleCollectionsRequests(instanceName))
        .catch(error => console.error(`Error deactivating ${collectionName} collection`, error));
}

function syncColletions(instanceName) {
    if (typeof instanceName === "undefined") {
        return;
    }
    return fetch(`/api/auth/kabanero/${instanceName}/collections/sync`)
        .then(handleCollectionsRequests(instanceName))
        .catch(error => console.error("Error syncing collections", error))
}

function updateCollectionView(collectionJSON) {
    if (typeof collectionJSON === "undefined") {
        return;
    }

    let collections = collectionJSON["kabanero collections"];
    let versionChangeCollections = collectionJSON["version change collections"];


    collections.forEach(coll => {
        $("#collection-table-body").append(createCollRow(coll));
    });

    function createCollRow(coll) {
        let row = $("<tr>");
        let name = $("<td>").text(coll.name);
        let version = $("<td>").text(coll.version);
        let collectionStatus = null;

        if(versionChangeCollections.length > 0){
            versionChangeCollections.forEach(collection => {
                collectionStatus = collection.name === coll.name ? collection.desiredState : coll.status
            });
        }
        else{
            collectionStatus = coll.status;
        }

        let status = $("<td>").text(collectionStatus);
        let deactivateCollection = createDeactivateCollectionButton(coll, collectionStatus);
        return row.append([name, version, status, deactivateCollection]);
    }

    function createDeactivateCollectionButton(coll, collectionStatus) {
        let iconStatus = collectionStatus === "active" ? "icon-active" : "icon-disabled";
        let deactivateCollection = $("<td>").addClass("deactivate-collection-td");
        let div = $("<div>").addClass(`deactivate-collection-icon ${iconStatus}`).attr("collection-name", coll.name).attr("data-modal-target", "#deactivate-collection-modal-" + iconStatus);
        let svg =`<svg focusable="false" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 32 32" aria-hidden="true" style="will-change: transform;"><path d="M16,4A12,12,0,1,1,4,16,12,12,0,0,1,16,4m0-2A14,14,0,1,0,30,16,14,14,0,0,0,16,2Z"></path><path d="M10 15H22V17H10z"></path><title>Deactivate ${coll.name} collection</title></svg>`

        div.append(svg);
        deactivateCollection.append(div);

        return deactivateCollection;
    }

    $(".table-loader").hide();
    $("#collection-table").show();
}

function setCLIVersion(cliVersion) {
    if(typeof cliVersion === "undefined"){
        return;
    }
    let version = cliVersion["image"].split(":")[1];
    $("#cli-version").append(version);
}

function getURLParam(key){
    return new URLSearchParams(window.location.search).get(key);
}

function handleInitialCLIAuth(instanceName){
    return fetch(`/api/auth/kabanero/${instanceName}/collections/list`)
        .then(function(response) {

            // Login via cli and retry if 401 is returned on initial call
            if(response.status === 401){
                return loginViaCLI(instanceName)
                    .then(() => {
                        return handleInitialCLIAuth(instanceName);
                    });
            }
            else if(response.status !== 200){
                console.warn(`Initial auth into instance ${instanceName} returned status code: ${response.status}`);
            }

            // pass on instance name var to the next function in the promise chain
            return instanceName;
        })
        .catch(error => console.error(`Error handling initial auth into instance ${instanceName} via CLI server`, error));
}

function loginViaCLI(instanceName){
    if(typeof instanceName === "undefined"){
        console.warn("CLI login cannot login without an instanceName");
        return;
    }

    return fetch(`/api/auth/kabanero/${instanceName}/collections/login`)
        .catch(error => console.error(`Error logging into instance ${instanceName} via CLI server`, error));
}