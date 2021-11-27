#include "Replacer.hpp"

Replacer::Replacer(const Config &config)
    : _config(config), _generators(config.generators()) {}

map<string, vector<std::pair<shared_ptr<IGeneratorMeta>, string>>>
Replacer::generate_map() {
  map<string, vector<std::pair<shared_ptr<IGeneratorMeta>, string>>> result;
  auto lang_list = generate();
  for (auto lang : lang_list) {
    auto lang_generated = lang->result();
    for (auto lang_item : *lang_generated) {
      const string &src = lang_item.first;
      const string &dst = lang_item.second;
      shared_ptr<IGeneratorMeta> meta = lang->meta();
      result[src].emplace_back(meta, dst);
    }
  }
  return result;
}

vector<shared_ptr<ILangResult>> Replacer::generate() {
  _result_cache.clear();
  _group_cache.clear();
  vector<shared_ptr<ILangResult>> results;
  for (auto gen : this->_generators) {
    if (gen->meta()->completed()) {
      auto new_results = _get_generator_results(gen);
      results.insert(results.end(), new_results.begin(), new_results.end());
    }
  }
  return results;
}

vector<shared_ptr<ILangResult>>
Replacer::get_group_results(const string &group) {
  auto gcache_found = _group_cache.find(group);
  if (gcache_found == _group_cache.end()) {
    // new group
    vector<shared_ptr<ILangResult>> results;
    for (auto gen : this->_generators) {
      if (gen->meta()->group() == group) {
        auto new_results = _get_generator_results(gen);
        results.insert(results.end(), new_results.begin(), new_results.end());
      }
    }
    _group_cache.emplace(group, results);
    return results;
  } else {
    // old group
    return gcache_found->second;
  }
}

vector<shared_ptr<ILangResult>>
Replacer::_get_generator_results(shared_ptr<Generator> gen) {
  auto rcache_found = _result_cache.find(gen);
  if (rcache_found == _result_cache.end()) {
    // new result
    auto new_results = gen->results(this);
    _result_cache[gen] = new_results;
    return new_results;
  } else {
    // old result
    return rcache_found->second;
  }
}

bool Replacer::_path_valid(const fs::path &path, bool require_exist) {
  return (!path.empty()) && (!require_exist || fs::exists(path));
}

bool Replacer::_read_language_file(const fs::path &path, LangFile &file) {
  if (!_path_valid(path)) {
    return false;
  }
  std::ifstream istrm(path.string(), std::ios::in);
  if (istrm) {
    istrm >> file;
    return true;
  } else {
    return false;
  }
}

bool Replacer::_write_language_file(const fs::path &path,
                                    const LangFile &file) {
  if (!_path_valid(path, false)) {
    return false;
  }
  std::ofstream ostrm(path.string(), std::ios::out);
  if (ostrm) {
    ostrm << file;
    return true;
  } else {
    return false;
  }
}

bool Replacer::replace() {
  // check paths, load source
  LangFile main_source, extra_source, main_target, extra_target;
  set<string> extra_source_removal{};
  bool valid_main_source =
           _read_language_file(_config.main_source_path(), main_source),
       valid_extra_source =
           _read_language_file(_config.extra_source_path(), extra_source),
       valid_main_target = _path_valid(_config.main_target_path(), false),
       valid_extra_target = _path_valid(_config.extra_target_path(), false);
  if (!valid_main_source || !valid_main_target) {
    return false;
  }

  // replace
  auto dict = generate_map();
  map<string, string> extra_dict{};
  if (valid_extra_source) {
    for (const auto &item : extra_source.items()) {
      extra_dict.insert(item);
    }
  }

  const auto &items = main_source.items();
  for (const auto &item : items) {
    const string &key = item.first;
    const string &source_text = item.second;
    bool succ, succ_dict = false, succ_extra = false;
    string target_text, target_text_dict, target_text_extra;

    // dict
    auto dict_found = dict.find(source_text);
    if (dict_found != dict.cend()) {
      // replaced
      const auto &lang_results = (*dict_found).second;
      const auto &config_extensions = _config.extensions();
      GeneratorMeta source_meta{};
      source_meta.namespace_prefix() = key;
      source_meta.extensions().insert(config_extensions.cbegin(),
                                      config_extensions.cend());
      for (const auto &lang_result : lang_results) {
        if (lang_result.first->contains(source_meta)) {
          target_text_dict = lang_result.second;
          succ_dict = true;
        }
      }
    }

    // extra
    if (valid_extra_source) {
      const auto &extra_source_items = extra_source.items();
      auto extra_source_found = extra_dict.find(key);
      if (extra_source_found != extra_dict.cend()) {
        // use extra item
        target_text_extra = (*extra_source_found).second;
        succ_extra = true;
      }
    }

    // judge
    if (succ_dict && succ_extra) {
      // CONFLICT
      target_text = target_text_dict;
      succ = true;
    } else if (succ_dict && !succ_extra) {
      // REPLACED
      target_text = target_text_dict;
      succ = true;
    } else if (!succ_dict && succ_extra) {
      // FALLBACK
      target_text = target_text_extra;
      succ = true;
    } else if (!succ_dict && !succ_extra) {
      // FAILED
      target_text = source_text;
      succ = false;
    }

    main_target.items().emplace_back(key, target_text);
    if (valid_extra_target) {
      // output all unknown items
      if (!succ) {
        extra_target.items().emplace_back(key, target_text);
      }
    }
    if (_config.remove_redundant_fallback()) {
      // remove matched
      if (succ_extra && succ_dict) {
        extra_source_removal.emplace(key);
      }
    }
  }

  // write
  bool write_success = true;
  write_success &=
      _write_language_file(_config.main_target_path(), main_target);
  if (valid_extra_target) {
    write_success &=
        _write_language_file(_config.extra_target_path(), extra_target);
  }
  if (_config.remove_redundant_fallback()) {
    LangFile extra_source_modified;
    const auto &extra_source_items = extra_source.items();
    for (const auto &item : extra_source_items) {
      if (extra_source_removal.find(item.first) ==
          extra_source_removal.cend()) {
        extra_source_modified.items().emplace_back(item);
      }
    }
    write_success &= _write_language_file(_config.extra_source_path(),
                                          extra_source_modified);
  }
  return write_success;
}
