#ifndef REPLACER_H
#define REPLACER_H
#pragma once

#include <exception>
#include <fstream>
#include <iostream>
#include <memory>
#include <sstream>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

#include <boost/filesystem.hpp>
#include <boost/program_options.hpp>
// clang-format off
#include <ryml/ryml_std.hpp>
#include <ryml/ryml.hpp>
// clang-format on

#include "generator/DictGenerator.hpp"
#include "generator/Generator.hpp"
#include "generator/Rule.hpp"
#include "generator/RuleGenerator.hpp"
#include "meta/GeneratorMeta.hpp"
#include "meta/IGroupRepository.hpp"

using std::string;
using std::vector;
namespace po = boost::program_options;
namespace fs = boost::filesystem;

class Replacer : public virtual IGroupRepository {

private:
  fs::path _main_source_path, _extra_source_path, _main_target_path,
      _extra_target_path, _config_path;
  string _lang, _version;
  vector<Generator> _generators;

  std::unordered_map<Generator *, vector<shared_ptr<ILangResult>>>
      _result_cache;
  std::unordered_map<string, vector<shared_ptr<ILangResult>>> _group_cache;
  vector<shared_ptr<ILangResult>> _get_generator_results(Generator *gen);

  string _get_file_contents(const string &filename);
  void _parse_config();
  void _parse_generator(const ryml::NodeRef &node);
  shared_ptr<Rule> _parse_rule(const ryml::NodeRef &node);
  static string _read_val(const ryml::NodeRef &node);
  static string _read_val(const ryml::NodeRef &node, const string &key);
  static bool _str2bool(const string &str);
  static string _csubstr2str(const c4::csubstr &str);

public:
  Replacer(int argc, char const *argv[]);
  ~Replacer();
  const fs::path &main_source_path();
  const fs::path &extra_source_path();
  const fs::path &main_target_path();
  const fs::path &extra_target_path();
  const fs::path &config_path();
  const string &lang();
  const string &version();
  const vector<Generator> &generators();

  vector<shared_ptr<ILangResult>> generate();
  virtual vector<shared_ptr<ILangResult>>
  get_group_results(const string &group) override;
};
#endif